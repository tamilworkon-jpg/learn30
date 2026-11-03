// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Window } from '../../server/auth';
import { startHarness, type Harness } from './server-harness';

// Hundreds of sequential scrypt-backed requests per test: allow for a busy machine (full suite in parallel).
vi.setConfig({ testTimeout: 30_000 });

let h: Harness | undefined;
afterEach(async () => {
  await h?.close();
  h = undefined;
});

const REMOTE = { 'X-Forwarded-For': '203.0.113.5' };
const login = (hh: Harness, username: string, password: string, headers: Record<string, string> = REMOTE) =>
  hh.api('POST', '/api/auth/login', { username, password }, undefined, headers);

describe('SV3 rate limit — remote clients (T188, T192 M1)', () => {
  it('10 failed logins per (IP, username) per 15 min → 429 with Retry-After; even the right password; window expiry re-allows', async () => {
    h = await startHarness();
    await h.signup('ivy', 'password123');
    for (let i = 0; i < 10; i++) expect((await login(h, 'ivy', `wrong-${i}xx`)).status).toBe(401);
    const blocked = await login(h, 'ivy', 'password123');
    expect(blocked.status).toBe(429);
    const ra = Number(blocked.headers['retry-after']);
    expect(ra).toBeGreaterThan(0);
    expect(ra).toBeLessThanOrEqual(15 * 60);
    // Another username from the same IP, and the same username from another IP, are not blocked.
    await h.signup('jack', 'password123');
    expect((await login(h, 'jack', 'password123')).status).toBe(200);
    expect((await login(h, 'ivy', 'password123', { 'X-Forwarded-For': '198.51.100.7' })).status).toBe(200);
    h.clock.t += 15 * 60 * 1000 + 1;
    expect((await login(h, 'ivy', 'password123')).status).toBe(200);
  });

  it('50 failures per IP across usernames → 429; sign-up shares the limiter; another IP is unaffected', async () => {
    h = await startHarness();
    for (let i = 0; i < 50; i++) expect((await login(h, `user_${i}`, 'password123')).status).toBe(401);
    const r = await login(h, 'someone_new', 'password123');
    expect(r.status).toBe(429);
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
    expect((await h.api('POST', '/api/auth/signup', { username: 'fresh_user', password: 'password123' }, undefined, REMOTE)).status).toBe(429);
    expect((await login(h, 'someone_new', 'password123', { 'X-Forwarded-For': '198.51.100.8' })).status).toBe(401);
  });

  it('the per-IP key is the right-most X-Forwarded-For entry (client-supplied entries cannot dodge the cap)', async () => {
    h = await startHarness();
    for (let i = 0; i < 50; i++) {
      expect((await login(h, `user_${i}`, 'password123', { 'X-Forwarded-For': `10.0.0.${i}, 203.0.113.9` })).status).toBe(401);
    }
    expect((await login(h, 'user_x', 'password123', { 'X-Forwarded-For': '10.9.9.9, 203.0.113.9' })).status).toBe(429);
  });

  it('failed sign-ups (409 taken) count toward the limit', async () => {
    h = await startHarness();
    await h.signup('kim', 'password123');
    const again = () => h!.api('POST', '/api/auth/signup', { username: 'kim', password: 'password123' }, undefined, REMOTE);
    for (let i = 0; i < 10; i++) expect((await again()).status).toBe(409);
    const r = await again();
    expect(r.status).toBe(429);
    expect(r.headers['retry-after']).toBeDefined();
  });

  it('M1: 30 concurrent wrong logins → at most 10 get 401, the rest 429 (attempts are reserved before scrypt)', async () => {
    h = await startHarness();
    await h.signup('lena', 'password123');
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => login(h!, 'lena', `guess-${i}-xx`)));
    const by = (s: number) => results.filter((r) => r.status === s).length;
    expect(by(401)).toBeLessThanOrEqual(10);
    expect(by(401) + by(429)).toBe(30);
    expect(by(429)).toBeGreaterThanOrEqual(20);
  });

  it('M1: concurrent wrong logins across usernames cannot exceed the per-IP cap', async () => {
    h = await startHarness();
    const results = await Promise.all(Array.from({ length: 80 }, (_, i) => login(h!, `nobody_${i}`, 'password123')));
    expect(results.filter((r) => r.status === 401).length).toBe(50);
    expect(results.filter((r) => r.status === 429).length).toBe(30);
  });

  it('a successful login does not consume an attempt', async () => {
    h = await startHarness();
    await h.signup('mona', 'password123');
    for (let i = 0; i < 15; i++) expect((await login(h, 'mona', 'password123')).status).toBe(200);
  });
});

describe('SV3 rate limit — loopback peers (T192 M3)', () => {
  it('per-user bucket is keyed on the username; the shared loopback IP cap is higher (200)', async () => {
    h = await startHarness();
    await h.signup('nora', 'password123');
    for (let i = 0; i < 10; i++) expect((await login(h, 'nora', `wrong-${i}xx`, {})).status).toBe(401);
    expect((await login(h, 'nora', 'password123', {})).status).toBe(429);
    // 50+ failures on other usernames do not lock everyone behind the tunnel out.
    for (let i = 0; i < 60; i++) expect((await login(h, `ghost_${i}`, 'password123', {})).status).toBe(401);
    await h.signup('olga', 'password123');
    expect((await login(h, 'olga', 'password123', {})).status).toBe(200);
    for (let i = 60; i < 189; i++) await login(h, `ghost_${i}`, 'password123', {});
    // 10 + 60 + 129 = 199 failures so far: one more fills the cap, then everyone on loopback waits.
    expect((await login(h, 'ghost_last', 'password123', {})).status).toBe(401);
    expect((await login(h, 'olga', 'password123', {})).status).toBe(429);
  });

  it('without AIP_TRUST_PROXY, X-Forwarded-For is ignored (rotating it does not reset the buckets)', async () => {
    h = await startHarness({ trustProxy: false });
    await h.signup('pia', 'password123');
    for (let i = 0; i < 10; i++) {
      expect((await login(h, 'pia', `wrong-${i}xx`, { 'X-Forwarded-For': `198.51.100.${i}` })).status).toBe(401);
    }
    expect((await login(h, 'pia', 'password123', { 'X-Forwarded-For': '198.51.100.99' })).status).toBe(429);
  });
});

describe('sign-up caps (T192 M2)', () => {
  it('successful sign-ups per IP per hour (5 remote, ×4 for loopback) → 429 + Retry-After; resets after an hour', async () => {
    h = await startHarness({ limits: { signupsPerHour: 5 } });
    const signup = (u: string, headers: Record<string, string>) =>
      h!.api('POST', '/api/auth/signup', { username: u, password: 'password123' }, undefined, headers);
    for (let i = 0; i < 5; i++) expect((await signup(`remote_${i}`, REMOTE)).status).toBe(201);
    const r = await signup('remote_5', REMOTE);
    expect(r.status).toBe(429);
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(15 * 60);
    expect((await signup('other_ip', { 'X-Forwarded-For': '198.51.100.20' })).status).toBe(201);
    for (let i = 0; i < 20; i++) expect((await signup(`local_${i}`, {})).status).toBe(201);
    expect((await signup('local_20', {})).status).toBe(429);
    h.clock.t += 60 * 60 * 1000 + 1;
    expect((await signup('remote_5', REMOTE)).status).toBe(201);
  });

  it('failed sign-ups do not use up the successful-sign-up allowance', async () => {
    h = await startHarness({ limits: { signupsPerHour: 2 } });
    for (let i = 0; i < 5; i++) {
      expect((await h.api('POST', '/api/auth/signup', { username: 'x', password: 'password123' }, undefined, REMOTE)).status).toBe(400);
    }
    for (let i = 0; i < 2; i++) {
      expect((await h.api('POST', '/api/auth/signup', { username: `ok_${i}`, password: 'password123' }, undefined, REMOTE)).status).toBe(201);
    }
  });

  it('AIP_MAX_USERS caps the number of accounts → 403 with a clear message, also under concurrency', async () => {
    h = await startHarness({ maxUsers: 3 });
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, i) => h!.api('POST', '/api/auth/signup', { username: `cap_${i}`, password: 'password123' })),
    );
    expect(results.filter((r) => r.status === 201).length).toBe(3);
    const refused = results.filter((r) => r.status === 403);
    expect(refused.length).toBe(3);
    expect((refused[0].json() as { error: string }).error).toMatch(/limit of 3 accounts.*AIP_MAX_USERS/);
    // Existing accounts can still sign in.
    expect((await h.api('POST', '/api/auth/login', { username: (results.find((r) => r.status === 201)!.json() as { user: { username: string } }).user.username, password: 'password123' })).status).toBe(200);
  });
});

describe('re-verification on PATCH/DELETE /api/me (T192 L2)', () => {
  it('wrong current password is rate-limited per user (10 → 429); over-long passwords are refused', async () => {
    h = await startHarness();
    const { cookie } = await h.signup('quinn', 'password123');
    expect((await h.api('PATCH', '/api/me', { currentPassword: 'x'.repeat(1025), newPassword: 'newpassword1' }, cookie)).status).toBe(403);
    expect((await h.api('DELETE', '/api/me', { password: 'x'.repeat(5000) }, cookie)).status).toBe(403);
    for (let i = 0; i < 8; i++) {
      expect((await h.api('PATCH', '/api/me', { currentPassword: `wrong-${i}`, newPassword: 'newpassword1' }, cookie)).status).toBe(403);
    }
    const r = await h.api('DELETE', '/api/me', { password: 'password123' }, cookie);
    expect(r.status).toBe(429);
    expect(r.headers['retry-after']).toBeDefined();
    h.clock.t += 15 * 60 * 1000 + 1;
    expect((await h.api('PATCH', '/api/me', { currentPassword: 'password123', newPassword: 'newpassword1' }, cookie)).status).toBe(200);
  });
});

describe('limiter housekeeping (T192 L9)', () => {
  it('sweep() drops expired keys', () => {
    const clock = { t: 0 };
    const w = new Window(() => clock.t, 1000);
    for (let i = 0; i < 100; i++) w.reserve([{ key: `k${i}`, max: 5 }]);
    expect(w.size).toBe(100);
    clock.t = 1001;
    w.sweep();
    expect(w.size).toBe(0);
  });

  it('a released reservation frees its slot', () => {
    const w = new Window(() => 5, 1000);
    const slots = [{ key: 'a', max: 1 }];
    const r = w.reserve(slots);
    expect(typeof r).toBe('object');
    expect(w.reserve(slots)).toBeGreaterThan(0);
    (r as { release(): void }).release();
    expect(typeof w.reserve(slots)).toBe('object');
  });
});
