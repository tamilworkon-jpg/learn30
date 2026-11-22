// @vitest-environment node
// Admin console API (/api/admin/users…), the env-configured first admin, and closed public sign-up.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultProgress } from '../../server/api';
import { ensureAdminAccount } from '../../server/admin';
import { hashPassword, verifyPassword } from '../../server/auth';
import { openDb } from '../../server/db';
import { cookieOf, startHarness, TEST_SCRYPT_N, type Harness, type Res } from './server-harness';

const ADMIN = { username: 'boss', password: 'admin-pass-123' };
const AWS = 'aws-ai-practitioner';

function bootstrapOf(res: Res): { user: { isAdmin: boolean } | null; site: { signup: boolean } } {
  const m = /<script type="application\/json" id="aip-bootstrap">(.*?)<\/script><\/head>/s.exec(res.text);
  if (!m) throw new Error('no bootstrap: ' + res.text);
  return JSON.parse(m[1]);
}

let h: Harness;
let admin: string;
beforeAll(async () => {
  h = await startHarness({ admin: ADMIN, allowSignup: false });
  admin = cookieOf(await h.api('POST', '/api/auth/login', ADMIN));
});
afterAll(async () => {
  await h.close();
});

const create = (body: Record<string, unknown>, cookie = admin) => h.api('POST', '/api/admin/users', body, cookie);
const login = (username: string, password: string) => h.api('POST', '/api/auth/login', { username, password });

describe('closed sign-up (AIP_SIGNUP=closed)', () => {
  it('refuses /api/auth/signup, sends /signup to /login and tells pages sign-up is closed', async () => {
    const r = await h.api('POST', '/api/auth/signup', { username: 'walkin', password: 'password123' });
    expect(r.status).toBe(403);
    expect((r.json() as { error: string }).error).toMatch(/administrator/);
    const page = await h.req('GET', '/signup?next=%2Fsettings');
    expect(page.status).toBe(302);
    expect(page.headers.location).toBe('/login?next=%2Fsettings');
    expect(bootstrapOf(await h.req('GET', '/login')).site).toEqual({ signup: false });
  });
});

describe('admin account from the environment', () => {
  it('is created as an admin and shown as one in the bootstrap', async () => {
    const me = (await h.api('GET', '/api/me', undefined, admin)).json() as { user: { isAdmin: boolean } };
    expect(me.user.isAdmin).toBe(true);
    expect(bootstrapOf(await h.req('GET', '/admin', { cookie: admin })).user?.isAdmin).toBe(true);
  });

  it('promotes an existing account without changing its password', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'aip-admin-'));
    const db = await openDb(join(dir, 'a.db'));
    try {
      await db.run("INSERT INTO users (username, display_name, pass_hash, created_at) VALUES ('later', 'Later', ?, '2026-11-01T00:00:00Z')", await hashPassword('original-pw', TEST_SCRYPT_N));
      await ensureAdminAccount(db, 'Later', 'different-pw', TEST_SCRYPT_N, Date.now());
      const row = (await db.get<{ is_admin: number; pass_hash: string }>("SELECT is_admin, pass_hash FROM users WHERE username = 'later'"))!;
      expect(row.is_admin).toBe(1);
      expect(await verifyPassword('original-pw', row.pass_hash)).toBe(true);
      expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n).toBe(1);
    } finally {
      await db.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('admin access rules', () => {
  it('signed out → 401 / login redirect; learner → 403 on the API and the 404 page for /admin', async () => {
    expect((await create({ username: 'plain', password: 'password123' })).status).toBe(201);
    const learner = cookieOf(await login('plain', 'password123'));
    expect((await h.api('GET', '/api/admin/users')).status).toBe(401);
    expect((await h.api('GET', '/api/admin/users', undefined, learner)).status).toBe(403);
    expect((await create({ username: 'sneaky', password: 'password123' }, learner)).status).toBe(403);
    const page = await h.req('GET', '/admin', { cookie: learner });
    expect(page.status).toBe(404);
    expect(page.text).toContain('<h1>Not found</h1>');
    const out = await h.req('GET', '/admin');
    expect(out.status).toBe(302);
    expect(out.headers.location).toBe('/login?next=%2Fadmin');
    expect((await h.req('GET', '/admin', { cookie: admin })).status).toBe(200);
  });

  it('admin writes need the CSRF header', async () => {
    const r = await h.req('POST', '/api/admin/users', { body: { username: 'nocsrf', password: 'password123' }, cookie: admin, headers: { 'Content-Type': 'application/json' } });
    expect(r.status).toBe(403);
  });
});

describe('admin manages learners', () => {
  it('creates a learner who can sign in (no session is set for the admin), and lists their progress', async () => {
    const r = await create({ username: 'Learner.One', displayName: 'Learner One', password: 'first-pass-1' });
    expect(r.status).toBe(201);
    expect(r.headers['set-cookie']).toBeUndefined();
    const u = (r.json() as { user: { id: number; username: string; isAdmin: boolean } }).user;
    expect(u).toMatchObject({ username: 'learner.one', isAdmin: false });
    expect((await create({ username: 'learner.one', password: 'password123' })).status).toBe(409);
    expect((await create({ username: 'x', password: 'password123' })).status).toBe(400);
    expect((await create({ username: 'shortpw', password: 'short' })).status).toBe(400);

    const lc = cookieOf(await login('learner.one', 'first-pass-1'));
    const doc = defaultProgress(h.clock.t);
    doc.days = { '1': { status: 'completed', sectionsViewed: [] }, '2': { status: 'in-progress', sectionsViewed: [] } };
    doc.attempts = [
      { id: 'a1', assessmentId: 'day-01', kind: 'daily', startedAt: '2026-11-02T09:50:00.000Z', submittedAt: '2026-11-02T10:00:00.000Z', answers: {}, flagged: [], score: { correct: 8, total: 10, percent: 80 }, byDomain: {}, autoSubmitted: false },
      { id: 'a2', assessmentId: 'mock-1', kind: 'mock', startedAt: '2026-11-02T09:00:00.000Z', submittedAt: '2026-11-02T10:30:00.000Z', answers: {}, flagged: [], score: { correct: 40, total: 65, percent: 62, scaled: 720 }, byDomain: {}, autoSubmitted: false },
    ];
    const put = await h.api('PUT', `/api/courses/${AWS}/progress`, doc, lc);
    expect(put.status, put.text).toBe(204);

    const list = (await h.api('GET', '/api/admin/users', undefined, admin)).json() as {
      users: { id: number; username: string; lastLoginAt: string | null; lastActiveAt: string | null; courses: Record<string, Record<string, unknown>> }[];
      signupOpen: boolean;
      courseIds: string[];
    };
    expect(list.signupOpen).toBe(false);
    expect(list.courseIds).toContain(AWS);
    const row = list.users.find((x) => x.username === 'learner.one')!;
    expect(row.lastLoginAt).toBe(new Date(h.clock.t).toISOString());
    expect(row.lastActiveAt).toBe(new Date(h.clock.t).toISOString());
    expect(row.courses[AWS]).toMatchObject({ completed: 1, inProgress: 1, attempts: 2, averageScore: 71, bestMock: 720 });
    // No password hashes leave the server.
    expect(JSON.stringify(list)).not.toMatch(/scrypt\$/);

    const detail = (await h.api('GET', `/api/admin/users/${u.id}`, undefined, admin)).json() as {
      detail: Record<string, { days: Record<string, { status: string }>; attempts: { assessmentId: string; scaled: number | null }[] }>;
    };
    expect(detail.detail[AWS].days['1'].status).toBe('completed');
    expect(detail.detail[AWS].attempts.map((a) => [a.assessmentId, a.scaled])).toEqual([
      ['day-01', null],
      ['mock-1', 720],
    ]);
    expect((await h.api('GET', '/api/admin/users/999999', undefined, admin)).status).toBe(404);
  });

  it('resets a password: the learner is signed out everywhere and only the new password works', async () => {
    const id = ((await create({ username: 'forgetful', password: 'old-password' })).json() as { user: { id: number } }).user.id;
    const old = cookieOf(await login('forgetful', 'old-password'));
    expect((await h.api('PATCH', `/api/admin/users/${id}`, { password: 'new-password' }, admin)).status).toBe(200);
    expect((await h.api('GET', '/api/me', undefined, old)).status).toBe(401);
    expect((await login('forgetful', 'old-password')).status).toBe(401);
    expect((await login('forgetful', 'new-password')).status).toBe(200);
    // The admin's own session survives.
    expect((await h.api('GET', '/api/me', undefined, admin)).status).toBe(200);
    expect((await h.api('PATCH', `/api/admin/users/${id}`, { password: 'short' }, admin)).status).toBe(400);
    expect((await h.api('PATCH', `/api/admin/users/${id}`, { role: 'x' }, admin)).status).toBe(400);
  });

  it('grants and removes the admin role, but never the caller’s own', async () => {
    const id = ((await create({ username: 'deputy', password: 'password123' })).json() as { user: { id: number } }).user.id;
    expect(((await h.api('PATCH', `/api/admin/users/${id}`, { isAdmin: true }, admin)).json() as { user: { isAdmin: boolean } }).user.isAdmin).toBe(true);
    const deputy = cookieOf(await login('deputy', 'password123'));
    expect((await h.api('GET', '/api/admin/users', undefined, deputy)).status).toBe(200);
    expect((await h.api('PATCH', `/api/admin/users/${id}`, { isAdmin: false }, deputy)).status).toBe(409);
    expect((await h.api('PATCH', `/api/admin/users/${id}`, { isAdmin: false }, admin)).status).toBe(200);
    expect((await h.api('GET', '/api/admin/users', undefined, deputy)).status).toBe(403);
  });

  it('deletes a learner (sessions and progress go with them) but not the caller', async () => {
    const id = ((await create({ username: 'leaving', password: 'password123' })).json() as { user: { id: number } }).user.id;
    const c = cookieOf(await login('leaving', 'password123'));
    await h.api('PUT', `/api/courses/${AWS}/progress`, defaultProgress(h.clock.t), c);
    expect((await h.api('DELETE', `/api/admin/users/${id}`, undefined, admin)).status).toBe(204);
    expect((await h.api('GET', '/api/me', undefined, c)).status).toBe(401);
    expect((await h.api('GET', `/api/admin/users/${id}`, undefined, admin)).status).toBe(404);
    const me = ((await h.api('GET', '/api/me', undefined, admin)).json() as { user: { id: number } }).user.id;
    expect((await h.api('DELETE', `/api/admin/users/${me}`, undefined, admin)).status).toBe(409);
  });

  it('the only admin cannot delete their own account from Settings', async () => {
    const r = await h.api('DELETE', '/api/me', { password: ADMIN.password }, admin);
    expect(r.status).toBe(409);
    expect((await h.api('GET', '/api/me', undefined, admin)).status).toBe(200);
  });
});
