// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cookieOf, startHarness, type Harness } from './server-harness';

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

const DAY = 24 * 60 * 60 * 1000;

describe('SV1 auth flows (T188)', () => {
  it('sign-up → 201 user + session cookie with the contract attributes; progress created with startedAt = now', async () => {
    const { res, cookie } = await h.signup('Alice_1', 'password123', 'Alice');
    expect(res.status).toBe(201);
    const { user } = res.json() as { user: Record<string, unknown> };
    expect(user).toEqual({ id: expect.any(Number), username: 'alice_1', displayName: 'Alice', createdAt: new Date(h.clock.t).toISOString() });
    const sc = res.headers['set-cookie']![0];
    expect(sc).toMatch(/^aip_session=[A-Za-z0-9_-]{43}; /);
    for (const attr of ['HttpOnly', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000']) expect(sc).toContain(attr);
    expect(sc).not.toContain('Secure');
    const me = await h.api('GET', '/api/me', undefined, cookie);
    expect(me.status).toBe(200);
    expect(me.headers['cache-control']).toBe('no-store');
    expect((me.json() as { user: unknown }).user).toEqual(user);
    const p = await h.api('GET', '/api/progress', undefined, cookie);
    expect(p.status).toBe(200);
    expect((p.json() as { startedAt: string }).startedAt).toBe(new Date(h.clock.t).toISOString());
  });

  it('Secure is added when the request arrived over HTTPS (x-forwarded-proto)', async () => {
    const res = await h.api('POST', '/api/auth/signup', { username: 'secure_one', password: 'password123' }, undefined, {
      'X-Forwarded-Proto': 'https',
    });
    expect(res.status).toBe(201);
    expect(res.headers['set-cookie']![0]).toMatch(/; Secure$/);
  });

  it('display name defaults to the username; the raw token is never stored (sha256 hash only)', async () => {
    const { res, cookie } = await h.signup('bob.b', 'password123');
    expect((res.json() as { user: { displayName: string } }).user.displayName).toBe('bob.b');
    const db = new DatabaseSync(h.dbPath, { readOnly: true });
    const rows = db.prepare('SELECT token_hash FROM sessions').all() as { token_hash: string }[];
    const users = db.prepare("SELECT pass_hash FROM users WHERE username = 'bob.b'").get() as { pass_hash: string };
    db.close();
    const raw = cookie.split('=')[1];
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.token_hash) && r.token_hash !== raw)).toBe(true);
    expect(users.pass_hash).toMatch(/^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]{86}==$/);
  });

  it('password + username + display name rules → 400 with field', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ username: 'ab', password: 'password123' }, 'username'],
      [{ username: 'a'.repeat(31), password: 'password123' }, 'username'],
      [{ username: 'bad name', password: 'password123' }, 'username'],
      [{ username: 'ok_name', password: 'short' }, 'password'],
      [{ username: 'ok_name', password: 'x'.repeat(129) }, 'password'],
      [{ username: 'ok_name', password: 'password123', displayName: 'x'.repeat(31) }, 'displayName'],
      [{ username: 'ok_name', password: 'password123', displayName: 'bad\u0000name' }, 'displayName'],
    ];
    for (const [body, field] of cases) {
      const r = await h.api('POST', '/api/auth/signup', body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect((r.json() as { field: string }).field).toBe(field);
    }
    expect((await h.api('POST', '/api/auth/signup', { username: 'ok_name', password: 'x'.repeat(128) })).status).toBe(201);
  });

  it('duplicate username (case-insensitive) → 409', async () => {
    await h.signup('carol', 'password123');
    expect((await h.api('POST', '/api/auth/signup', { username: 'CAROL', password: 'password123' })).status).toBe(409);
  });

  it('login works (case-insensitive username); failure is a generic 401 for both wrong user and wrong password', async () => {
    await h.signup('dave', 'password123');
    const ok = await h.api('POST', '/api/auth/login', { username: 'Dave', password: 'password123' });
    expect(ok.status).toBe(200);
    expect((ok.json() as { user: { username: string } }).user.username).toBe('dave');
    expect(cookieOf(ok)).toMatch(/^aip_session=/);
    const wrongPw = await h.api('POST', '/api/auth/login', { username: 'dave', password: 'nope-nope' });
    const noUser = await h.api('POST', '/api/auth/login', { username: 'nobody_here', password: 'password123' });
    for (const r of [wrongPw, noUser]) {
      expect(r.status).toBe(401);
      expect(r.json()).toEqual({ error: 'Incorrect username or password.' });
      expect(r.headers['set-cookie']).toBeUndefined();
    }
  });

  it('logout → 204, cookie cleared, session row deleted (the old cookie no longer works)', async () => {
    const { cookie } = await h.signup('erin', 'password123');
    const out = await h.api('POST', '/api/auth/logout', undefined, cookie);
    expect(out.status).toBe(204);
    expect(out.headers['set-cookie']![0]).toMatch(/^aip_session=; .*Max-Age=0/);
    expect((await h.api('GET', '/api/me', undefined, cookie)).status).toBe(401);
  });

  it('GET /api/me signed out → 401 { error }; session-only endpoints → 401', async () => {
    const me = await h.api('GET', '/api/me');
    expect(me.status).toBe(401);
    expect(me.json()).toHaveProperty('error');
    expect((await h.api('GET', '/api/progress')).status).toBe(401);
    expect((await h.api('GET', '/api/ui')).status).toBe(401);
    expect((await h.api('PATCH', '/api/me', { displayName: 'X' })).status).toBe(401);
    expect((await h.api('GET', '/api/me', undefined, 'aip_session=forged-token')).status).toBe(401);
  });

  it('PATCH /api/me: display name; password change needs the current password (403) and signs out other sessions', async () => {
    const { cookie } = await h.signup('frank', 'password123');
    const other = cookieOf(await h.api('POST', '/api/auth/login', { username: 'frank', password: 'password123' }));
    const r1 = await h.api('PATCH', '/api/me', { displayName: '  Frank F  ' }, cookie);
    expect(r1.status).toBe(200);
    expect((r1.json() as { user: { displayName: string } }).user.displayName).toBe('Frank F');
    expect((await h.api('PATCH', '/api/me', { displayName: '' }, cookie)).status).toBe(400);
    expect((await h.api('PATCH', '/api/me', { newPassword: 'short' , currentPassword: 'password123' }, cookie)).status).toBe(400);
    expect((await h.api('PATCH', '/api/me', { newPassword: 'newpassword1', currentPassword: 'wrong-one' }, cookie)).status).toBe(403);
    expect((await h.api('PATCH', '/api/me', { newPassword: 'newpassword1' }, cookie)).status).toBe(403);
    expect((await h.api('PATCH', '/api/me', { newPassword: 'newpassword1', currentPassword: 'password123' }, cookie)).status).toBe(200);
    expect((await h.api('GET', '/api/me', undefined, cookie)).status).toBe(200);
    expect((await h.api('GET', '/api/me', undefined, other)).status).toBe(401);
    expect((await h.api('POST', '/api/auth/login', { username: 'frank', password: 'password123' })).status).toBe(401);
    expect((await h.api('POST', '/api/auth/login', { username: 'frank', password: 'newpassword1' })).status).toBe(200);
  });

  it('DELETE /api/me: wrong password 403; right password 204 and cascades sessions, progress and ui_state', async () => {
    const { cookie, res } = await h.signup('gina', 'password123');
    const id = (res.json() as { user: { id: number } }).user.id;
    await h.api('PUT', '/api/ui', { lessonView: 'full' }, cookie);
    expect((await h.api('DELETE', '/api/me', { password: 'wrong-pass' }, cookie)).status).toBe(403);
    const del = await h.api('DELETE', '/api/me', { password: 'password123' }, cookie);
    expect(del.status).toBe(204);
    expect(del.headers['set-cookie']![0]).toContain('Max-Age=0');
    const db = new DatabaseSync(h.dbPath, { readOnly: true });
    for (const t of ['sessions', 'progress', 'ui_state']) {
      expect((db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).get(id) as { n: number }).n, t).toBe(0);
    }
    expect((db.prepare('SELECT COUNT(*) AS n FROM users WHERE id = ?').get(id) as { n: number }).n).toBe(0);
    db.close();
    expect((await h.api('GET', '/api/me', undefined, cookie)).status).toBe(401);
    expect((await h.api('POST', '/api/auth/login', { username: 'gina', password: 'password123' })).status).toBe(401);
  });

  it('sliding expiry: refreshed at most once per hour; a session idle > 30 days expires', async () => {
    const { cookie } = await h.signup('hank', 'password123');
    h.clock.t += 30 * 60 * 1000; // 30 min: no refresh yet
    const a = await h.api('GET', '/api/me', undefined, cookie);
    expect(a.status).toBe(200);
    expect(a.headers['set-cookie']).toBeUndefined();
    h.clock.t += 31 * 60 * 1000; // > 1 h since issue: refreshed
    const b = await h.api('GET', '/api/me', undefined, cookie);
    expect(b.headers['set-cookie']![0]).toBe(`${cookie}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000`);
    const db = new DatabaseSync(h.dbPath, { readOnly: true });
    const exp = (db.prepare('SELECT MAX(expires_at) AS e FROM sessions').get() as { e: string }).e;
    db.close();
    expect(exp).toBe(new Date(h.clock.t + 30 * DAY).toISOString());
    h.clock.t += 29 * DAY; // still within the slid window
    expect((await h.api('GET', '/api/me', undefined, cookie)).status).toBe(200);
    h.clock.t += 30 * DAY + 1000; // idle past expiry
    expect((await h.api('GET', '/api/me', undefined, cookie)).status).toBe(401);
  });
});

describe('SV2 CSRF (T188)', () => {
  it('non-GET /api/* without X-AIP-Request → 403', async () => {
    const r = await h.req('POST', '/api/auth/signup', {
      body: { username: 'csrf_a', password: 'password123' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(r.status).toBe(403);
  });

  it('wrong content type (form post) → 403', async () => {
    const r = await h.req('POST', '/api/auth/login', {
      raw: 'username=a&password=b',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-AIP-Request': '1' },
    });
    expect(r.status).toBe(403);
    const t = await h.req('POST', '/api/auth/login', { raw: '{}', headers: { 'Content-Type': 'text/plain', 'X-AIP-Request': '1' } });
    expect(t.status).toBe(403);
    const none = await h.req('POST', '/api/auth/login', { raw: '{"username":"x"}', headers: { 'X-AIP-Request': '1' } });
    expect(none.status).toBe(403);
  });

  it('Origin present and different from Host → 403; matching Origin OK; empty body without content type OK', async () => {
    const body = { username: 'csrf_b', password: 'password123' };
    expect((await h.api('POST', '/api/auth/signup', body, undefined, { Origin: 'https://evil.example' })).status).toBe(403);
    expect((await h.api('POST', '/api/auth/signup', body, undefined, { Origin: 'null' })).status).toBe(403);
    const ok = await h.api('POST', '/api/auth/signup', body, undefined, { Origin: h.base });
    expect(ok.status).toBe(201);
    const out = await h.req('POST', '/api/auth/logout', { cookie: cookieOf(ok), headers: { 'X-AIP-Request': '1' } });
    expect(out.status).toBe(204);
  });

  it('a signed-in cross-site write is rejected and has no effect', async () => {
    const { cookie } = await h.signup('csrf_c', 'password123');
    const r = await h.req('PUT', '/api/ui', { cookie, body: { lessonView: 'full' }, headers: { 'Content-Type': 'application/json' } });
    expect(r.status).toBe(403);
    expect((await h.api('GET', '/api/ui', undefined, cookie)).json()).toEqual({});
  });
});

describe('API misc (T188)', () => {
  it('unknown /api/* → 404 JSON; wrong method → 405; malformed JSON → 400', async () => {
    const r = await h.api('GET', '/api/nope');
    expect(r.status).toBe(404);
    expect(r.headers['content-type']).toContain('application/json');
    expect(r.json()).toHaveProperty('error');
    expect((await h.api('DELETE', '/api/progress')).status).toBe(405);
    const bad = await h.req('POST', '/api/auth/login', { raw: '{oops', headers: { 'Content-Type': 'application/json', 'X-AIP-Request': '1' } });
    expect(bad.status).toBe(400);
  });
});
