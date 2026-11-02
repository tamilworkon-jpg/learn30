// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startHarness, type Harness } from './server-harness';

let h: Harness;
beforeEach(async () => {
  h = await startHarness();
});
afterEach(async () => {
  await h.close();
});

describe('SV3 rate limit (T188)', () => {
  it('10 failed logins per (IP, username) per 15 min → 429 with Retry-After; even the right password; window expiry re-allows', async () => {
    await h.signup('ivy', 'password123');
    for (let i = 0; i < 10; i++) expect((await h.api('POST', '/api/auth/login', { username: 'ivy', password: `wrong-${i}xx` })).status).toBe(401);
    const blocked = await h.api('POST', '/api/auth/login', { username: 'ivy', password: 'password123' });
    expect(blocked.status).toBe(429);
    const ra = Number(blocked.headers['retry-after']);
    expect(ra).toBeGreaterThan(0);
    expect(ra).toBeLessThanOrEqual(15 * 60);
    // A different username from the same IP is not affected by the per-user limit.
    await h.signup('jack', 'password123');
    expect((await h.api('POST', '/api/auth/login', { username: 'jack', password: 'password123' })).status).toBe(200);
    h.clock.t += 15 * 60 * 1000 + 1;
    expect((await h.api('POST', '/api/auth/login', { username: 'ivy', password: 'password123' })).status).toBe(200);
  });

  it('50 failures per IP across usernames → 429', async () => {
    for (let i = 0; i < 50; i++) {
      expect((await h.api('POST', '/api/auth/login', { username: `user_${i}`, password: 'password123' })).status).toBe(401);
    }
    const r = await h.api('POST', '/api/auth/login', { username: 'someone_new', password: 'password123' });
    expect(r.status).toBe(429);
    expect(Number(r.headers['retry-after'])).toBeGreaterThan(0);
    // Sign-up shares the limiter.
    expect((await h.api('POST', '/api/auth/signup', { username: 'fresh_user', password: 'password123' })).status).toBe(429);
  });

  it('failed sign-ups (409 taken) count toward the limit', async () => {
    await h.signup('kim', 'password123');
    for (let i = 0; i < 10; i++) expect((await h.api('POST', '/api/auth/signup', { username: 'kim', password: 'password123' })).status).toBe(409);
    const r = await h.api('POST', '/api/auth/signup', { username: 'kim', password: 'password123' });
    expect(r.status).toBe(429);
    expect(r.headers['retry-after']).toBeDefined();
  });
});
