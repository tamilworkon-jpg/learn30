// Admin API: learners' progress across courses, and account management (create, reset password, roles, delete).
// Every route needs a signed-in admin; writes also pass the CSRF checks in handleApi.
import type { IncomingMessage } from 'node:http';
import type { Progress } from '../src/lib/types';
import { checkDisplayName, checkPassword, checkUsername, hashPassword, publicUser, type UserRow } from './auth';
import { accountLimit, deleteUserRows, err, findUser, objectBody, readJson, requireSession, userCount, type ApiContext, type Handler, type Result } from './api';
import type { DbOps } from './db';

export interface CourseStats {
  startedAt: string | null;
  updatedAt: string;
  completed: number;
  inProgress: number;
  attempts: number;
  /** Mean percent over submitted quiz / test / mock attempts (null when none). */
  averageScore: number | null;
  /** Best scaled mock score (100–1000), null when no mock was taken. */
  bestMock: number | null;
  streak: { current: number; longest: number };
  lastPosition: { day: number; sectionId: string; updatedAt: string } | null;
}

export interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  /** Latest progress save in any course. */
  lastActiveAt: string | null;
  courses: Record<string, CourseStats>;
}

function parseDoc(doc: string): Partial<Progress> {
  try {
    const v = JSON.parse(doc) as unknown;
    return v && typeof v === 'object' ? (v as Partial<Progress>) : {};
  } catch {
    return {};
  }
}

export function courseStats(doc: Partial<Progress>, updatedAt: string): CourseStats {
  const days = doc.days && typeof doc.days === 'object' ? Object.values(doc.days) : [];
  const attempts = Array.isArray(doc.attempts) ? doc.attempts : [];
  const percents = attempts.map((a) => a?.score?.percent).filter((p): p is number => typeof p === 'number' && Number.isFinite(p));
  const mocks = attempts
    .filter((a) => a?.kind === 'mock')
    .map((a) => a.score?.scaled)
    .filter((s): s is number => typeof s === 'number');
  return {
    startedAt: typeof doc.startedAt === 'string' ? doc.startedAt : null,
    updatedAt,
    completed: days.filter((d) => d?.status === 'completed').length,
    inProgress: days.filter((d) => d?.status === 'in-progress').length,
    attempts: attempts.length,
    averageScore: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null,
    bestMock: mocks.length ? Math.max(...mocks) : null,
    streak: { current: Number(doc.streak?.current ?? 0) || 0, longest: Number(doc.streak?.longest ?? 0) || 0 },
    lastPosition: doc.lastPosition ?? null,
  };
}

function adminUser(u: UserRow, rows: { course_id: string; doc: string; updated_at: string }[]): AdminUser {
  const courses: Record<string, CourseStats> = {};
  let lastActiveAt: string | null = null;
  for (const r of rows) {
    courses[r.course_id] = courseStats(parseDoc(r.doc), r.updated_at);
    if (!lastActiveAt || r.updated_at > lastActiveAt) lastActiveAt = r.updated_at;
  }
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    isAdmin: !!u.is_admin,
    createdAt: u.created_at,
    lastLoginAt: u.last_login_at ?? null,
    lastActiveAt,
    courses,
  };
}

function requireAdmin(ctx: ApiContext) {
  const s = requireSession(ctx);
  if (!s.user.is_admin) throw err(403, 'Administrators only.');
  return s;
}

async function userById(db: DbOps, id: number): Promise<UserRow> {
  const u = await db.get<UserRow>('SELECT * FROM users WHERE id = ?', id);
  if (!u) throw err(404, 'No such user.');
  return u;
}

async function listUsers(_req: IncomingMessage, ctx: ApiContext): Promise<Result> {
  requireAdmin(ctx);
  const users = await ctx.db.all<UserRow>('SELECT * FROM users ORDER BY username');
  const rows = await ctx.db.all<{ user_id: number; course_id: string; doc: string; updated_at: string }>('SELECT user_id, course_id, doc, updated_at FROM progress');
  const byUser = new Map<number, typeof rows>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  return {
    status: 200,
    body: {
      users: users.map((u) => adminUser(u, byUser.get(u.id) ?? [])),
      courseIds: ctx.courseIds,
      signupOpen: ctx.allowSignup,
      maxUsers: ctx.maxUsers,
    },
  };
}

/** One learner in detail: per course, every day's status and each submitted attempt. */
async function getUser(ctx: ApiContext, id: number): Promise<Result> {
  requireAdmin(ctx);
  const u = await userById(ctx.db, id);
  const rows = await ctx.db.all<{ course_id: string; doc: string; updated_at: string }>('SELECT course_id, doc, updated_at FROM progress WHERE user_id = ? ORDER BY course_id', id);
  const detail: Record<string, unknown> = {};
  for (const r of rows) {
    const doc = parseDoc(r.doc);
    const days: Record<string, { status: string; completedAt: string | null; bestScore: number | null }> = {};
    for (const [day, d] of Object.entries(doc.days ?? {})) {
      if (d && typeof d === 'object') days[day] = { status: String(d.status ?? 'not-started'), completedAt: d.completedAt ?? null, bestScore: typeof d.bestScore === 'number' ? d.bestScore : null };
    }
    const attempts = (Array.isArray(doc.attempts) ? doc.attempts : []).map((a) => ({
      assessmentId: String(a?.assessmentId ?? ''),
      kind: String(a?.kind ?? ''),
      submittedAt: String(a?.submittedAt ?? ''),
      percent: typeof a?.score?.percent === 'number' ? a.score.percent : null,
      scaled: typeof a?.score?.scaled === 'number' ? a.score.scaled : null,
      correct: typeof a?.score?.correct === 'number' ? a.score.correct : null,
      total: typeof a?.score?.total === 'number' ? a.score.total : null,
    }));
    detail[r.course_id] = { stats: courseStats(doc, r.updated_at), days, attempts };
  }
  return { status: 200, body: { user: adminUser(u, rows), detail } };
}

async function createUser(req: IncomingMessage, ctx: ApiContext): Promise<Result> {
  requireAdmin(ctx);
  const b = objectBody(await readJson(req));
  const username = checkUsername(b.username);
  if (!username) throw err(400, 'Username must be 3–30 characters: a–z, 0–9, _ . -', { field: 'username' });
  if (!checkPassword(b.password)) throw err(400, 'Password must be 8–128 characters.', { field: 'password' });
  let displayName = username;
  if (b.displayName !== undefined && !(typeof b.displayName === 'string' && b.displayName.trim() === '')) {
    const d = checkDisplayName(b.displayName);
    if (!d) throw err(400, 'Display name must be 1–30 characters (no control or invisible characters).', { field: 'displayName' });
    displayName = d;
  }
  if (b.isAdmin !== undefined && typeof b.isAdmin !== 'boolean') throw err(400, 'isAdmin must be true or false.', { field: 'isAdmin' });
  if (await findUser(ctx.db, username)) throw err(409, 'That username is taken.', { field: 'username' });
  const passHash = await hashPassword(b.password, ctx.scryptN);
  const iso = new Date(ctx.now()).toISOString();
  let id: number;
  try {
    id = await ctx.db.transaction(async (t) => {
      if ((await userCount(t)) >= ctx.maxUsers) throw accountLimit(ctx.maxUsers);
      const r = await t.run('INSERT INTO users (username, display_name, pass_hash, created_at, is_admin) VALUES (?, ?, ?, ?, ?)', username, displayName, passHash, iso, b.isAdmin ? 1 : 0);
      return r.lastInsertRowid;
    });
  } catch (e) {
    if (/UNIQUE/i.test(String((e as Error).message))) throw err(409, 'That username is taken.', { field: 'username' });
    throw e;
  }
  return { status: 201, body: { user: adminUser(await userById(ctx.db, id), []) } };
}

async function updateUser(req: IncomingMessage, ctx: ApiContext, id: number): Promise<Result> {
  const s = requireAdmin(ctx);
  const b = objectBody(await readJson(req));
  const unknown = Object.keys(b).filter((k) => !['displayName', 'password', 'isAdmin'].includes(k));
  if (unknown.length) throw err(400, `Unknown field: ${unknown[0].slice(0, 40)}.`, { field: unknown[0].slice(0, 40) });
  const u = await userById(ctx.db, id);
  let displayName = u.display_name;
  if (b.displayName !== undefined) {
    const d = checkDisplayName(b.displayName);
    if (!d) throw err(400, 'Display name must be 1–30 characters.', { field: 'displayName' });
    displayName = d;
  }
  let isAdmin = u.is_admin ? 1 : 0;
  if (b.isAdmin !== undefined) {
    if (typeof b.isAdmin !== 'boolean') throw err(400, 'isAdmin must be true or false.', { field: 'isAdmin' });
    if (!b.isAdmin && u.id === s.user.id) throw err(409, 'You cannot remove your own admin role.', { field: 'isAdmin' });
    isAdmin = b.isAdmin ? 1 : 0;
  }
  let passHash = u.pass_hash;
  if (b.password !== undefined) {
    if (!checkPassword(b.password)) throw err(400, 'Password must be 8–128 characters.', { field: 'password' });
    passHash = await hashPassword(b.password, ctx.scryptN);
  }
  await ctx.db.transaction(async (t) => {
    await t.run('UPDATE users SET display_name = ?, pass_hash = ?, is_admin = ? WHERE id = ?', displayName, passHash, isAdmin, id);
    // A password reset signs the learner out everywhere (except the admin's own current session).
    if (passHash !== u.pass_hash) await t.run('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?', id, s.tokenHash);
  });
  return { status: 200, body: { user: publicUser({ ...u, display_name: displayName, pass_hash: passHash, is_admin: isAdmin }) } };
}

async function deleteUser(req: IncomingMessage, ctx: ApiContext, id: number): Promise<Result> {
  const s = requireAdmin(ctx);
  await readJson(req);
  if (id === s.user.id) throw err(409, 'You cannot delete your own account here. Use Settings → Account.');
  await userById(ctx.db, id);
  await deleteUserRows(ctx.db, id);
  return { status: 204, body: null };
}

/** Routes under /api/admin/… (undefined when the path is not an admin route). */
export function adminRoute(path: string): Partial<Record<string, Handler>> | undefined {
  if (path === '/api/admin/users') return { GET: listUsers, POST: createUser };
  const m = /^\/api\/admin\/users\/([1-9][0-9]{0,11})$/.exec(path);
  if (!m) return undefined;
  const id = Number(m[1]);
  return {
    GET: (_req, ctx) => getUser(ctx, id),
    PATCH: (req, ctx) => updateUser(req, ctx, id),
    DELETE: (req, ctx) => deleteUser(req, ctx, id),
  };
}

/**
 * First admin from the environment (AIP_ADMIN_USERNAME + AIP_ADMIN_PASSWORD): created when missing, or promoted
 * when the account already exists (its password is then left unchanged, so rotating the env var never locks anyone out).
 */
export async function ensureAdminAccount(db: DbOps, username: string, password: string, scryptN: number, now: number): Promise<void> {
  const u = checkUsername(username);
  if (!u) throw new Error('AIP_ADMIN_USERNAME must be 3–30 characters: a–z, 0–9, _ . -');
  if (!checkPassword(password)) throw new Error('AIP_ADMIN_PASSWORD must be 8–128 characters.');
  const existing = await findUser(db, u);
  if (existing) {
    if (!existing.is_admin) await db.run('UPDATE users SET is_admin = 1 WHERE id = ?', existing.id);
    return;
  }
  const passHash = await hashPassword(password, scryptN);
  await db.run('INSERT OR IGNORE INTO users (username, display_name, pass_hash, created_at, is_admin) VALUES (?, ?, ?, ?, 1)', u, u, passHash, new Date(now).toISOString());
}
