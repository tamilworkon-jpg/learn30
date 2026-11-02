import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import type { ErrorObject } from 'ajv';
import validateProgress from '../src/schemas/generated/validate-progress';
import { EXAM_GUIDE_VERSION } from '../src/lib/constants';
import type { Progress } from '../src/lib/types';
import { tx } from './db';
import {
  checkDisplayName,
  checkPassword,
  checkUsername,
  clearCookie,
  createSession,
  getDummyHash,
  hashPassword,
  isHttps,
  publicUser,
  sessionCookie,
  verifyPassword,
  type RateLimiter,
  type Session,
  type UserRow,
} from './auth';

export const MAX_BODY = 1024 * 1024;
export const MAX_UI_BYTES = 64 * 1024;

export interface ApiContext {
  db: DatabaseSync;
  limiter: RateLimiter;
  now: () => number;
  session: Session | null;
  ip: string;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown> | null,
    readonly headers: Record<string, string> = {},
  ) {
    super(String(body?.error ?? status));
  }
}

const err = (status: number, error: string, extra: Record<string, unknown> = {}) => new HttpError(status, { error, ...extra });

export function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string | string[]> = {}): void {
  const data = body === null ? null : Buffer.from(JSON.stringify(body), 'utf8');
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    ...(data ? { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(data.length) } : {}),
    ...headers,
  });
  res.end(data ?? undefined);
}

/** Read the body; over MAX_BODY → 413 (the rest is drained so the client sees the response). */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    const chunks: Buffer[] = [];
    let size = 0;
    let tooBig = declared > MAX_BODY;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) tooBig = true;
      if (!tooBig) chunks.push(c);
      else if (size > 16 * MAX_BODY) req.destroy();
    });
    req.on('end', () => (tooBig ? reject(err(413, 'Request body is too large.')) : resolve(Buffer.concat(chunks))));
    req.on('error', reject);
  });
}

/** Contract §3 CSRF rules for non-GET /api/* requests. */
function checkCsrf(req: IncomingMessage): void {
  if (req.headers['x-aip-request'] !== '1') throw err(403, 'Forbidden.');
  const ct = req.headers['content-type'];
  if (ct !== undefined && ct.split(';')[0].trim().toLowerCase() !== 'application/json') throw err(403, 'Forbidden.');
  const origin = req.headers.origin;
  if (origin !== undefined) {
    let host: string;
    try {
      host = new URL(origin).host.toLowerCase();
    } catch {
      throw err(403, 'Forbidden.');
    }
    const fwd = req.headers['x-forwarded-host'];
    const allowed = [req.headers.host, ...(Array.isArray(fwd) ? fwd : (fwd ?? '').split(','))]
      .filter((h): h is string => !!h)
      .map((h) => h.trim().toLowerCase());
    if (!host || !allowed.includes(host)) throw err(403, 'Forbidden.');
  }
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const body = await readBody(req);
  if (body.length === 0) return undefined;
  if (req.headers['content-type'] === undefined) throw err(403, 'Forbidden.');
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw err(400, 'Request body is not valid JSON.');
  }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function objectBody(v: unknown): Record<string, unknown> {
  if (v === undefined) return {};
  if (!isObject(v)) throw err(400, 'Request body must be a JSON object.');
  return v;
}

export function defaultProgress(now: number): Progress {
  return {
    schemaVersion: 1,
    examGuideVersion: EXAM_GUIDE_VERSION,
    startedAt: new Date(now).toISOString(),
    lastPosition: null,
    days: {},
    attempts: [],
    inProgress: {},
    streak: { current: 0, longest: 0 },
    badges: [],
    settings: {},
    ratings: {},
  };
}

// ---------- UiState (contract §4) ----------
const UI_ENUMS: Record<string, readonly string[]> = {
  lessonView: ['slides', 'full'],
  sidebar: ['expanded', 'collapsed'],
  sections: ['expanded', 'collapsed'],
};
const DAY_KEY = /^([1-9]|[12][0-9]|30)$/;

/** Returns an error message, or null when `v` is a valid UiState. */
export function uiStateError(v: unknown): string | null {
  if (!isObject(v)) return 'UI state must be an object.';
  for (const [k, val] of Object.entries(v)) {
    if (k in UI_ENUMS) {
      if (typeof val !== 'string' || !UI_ENUMS[k].includes(val)) return `Invalid value for ${k}.`;
    } else if (k === 'slides') {
      if (!isObject(val)) return 'slides must be an object.';
      for (const [day, pos] of Object.entries(val)) {
        if (!DAY_KEY.test(day)) return `Invalid day key in slides: ${day.slice(0, 10)}.`;
        if (!isObject(pos) || Object.keys(pos).some((x) => x !== 'sectionId' && x !== 'block')) return `Invalid slide position for day ${day}.`;
        if (typeof pos.sectionId !== 'string' || pos.sectionId.length > 200) return `Invalid sectionId for day ${day}.`;
        if (typeof pos.block !== 'number' || !Number.isInteger(pos.block) || pos.block < 0) return `Invalid block for day ${day}.`;
      }
    } else {
      return `Unknown key: ${k.slice(0, 40)}.`;
    }
  }
  return null;
}

function ajvText(errors: ErrorObject[] | null | undefined): string {
  return (errors ?? [])
    .slice(0, 5)
    .map((e) => `${e.instancePath || '(root)'} ${e.message ?? 'is invalid'}`)
    .join('; ');
}

// ---------- Data access ----------
export function getProgress(db: DatabaseSync, userId: number): unknown {
  const row = db.prepare('SELECT doc FROM progress WHERE user_id = ?').get(userId) as { doc: string } | undefined;
  return row ? JSON.parse(row.doc) : null;
}

export function getUi(db: DatabaseSync, userId: number): unknown {
  const row = db.prepare('SELECT doc FROM ui_state WHERE user_id = ?').get(userId) as { doc: string } | undefined;
  return row ? JSON.parse(row.doc) : {};
}

function findUser(db: DatabaseSync, username: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
}

function requireSession(ctx: ApiContext): Session {
  if (!ctx.session) throw err(401, 'Not signed in.');
  return ctx.session;
}

// ---------- Handlers ----------
type Result = { status: number; body: unknown; cookie?: string };

const INCORRECT = 'Incorrect username or password.';

async function signup(req: IncomingMessage, ctx: ApiContext): Promise<Result> {
  const b = objectBody(await readJson(req));
  const ipUser = typeof b.username === 'string' ? b.username.trim().toLowerCase().slice(0, 64) : '';
  const wait = ctx.limiter.retryAfter(ctx.ip, ipUser);
  if (wait) throw new HttpError(429, { error: 'Too many attempts. Try again later.' }, { 'Retry-After': String(wait) });
  const fail = (e: HttpError) => {
    ctx.limiter.fail(ctx.ip, ipUser);
    return e;
  };
  const username = checkUsername(b.username);
  if (!username) throw fail(err(400, 'Username must be 3–30 characters: a–z, 0–9, _ . -', { field: 'username' }));
  if (!checkPassword(b.password)) throw fail(err(400, 'Password must be 8–128 characters.', { field: 'password' }));
  let displayName = username;
  if (b.displayName !== undefined && !(typeof b.displayName === 'string' && b.displayName.trim() === '')) {
    const d = checkDisplayName(b.displayName);
    if (!d) throw fail(err(400, 'Display name must be 1–30 characters.', { field: 'displayName' }));
    displayName = d;
  }
  if (findUser(ctx.db, username)) throw fail(err(409, 'That username is taken.', { field: 'username' }));
  const passHash = await hashPassword(b.password);
  const now = ctx.now();
  const iso = new Date(now).toISOString();
  let user: UserRow;
  try {
    user = tx(ctx.db, () => {
      const r = ctx.db
        .prepare('INSERT INTO users (username, display_name, pass_hash, created_at) VALUES (?, ?, ?, ?)')
        .run(username, displayName, passHash, iso);
      const id = Number(r.lastInsertRowid);
      ctx.db.prepare('INSERT INTO progress (user_id, doc, updated_at) VALUES (?, ?, ?)').run(id, JSON.stringify(defaultProgress(now)), iso);
      return { id, username, display_name: displayName, pass_hash: passHash, created_at: iso };
    });
  } catch (e) {
    if (String((e as Error).message).includes('UNIQUE')) throw fail(err(409, 'That username is taken.', { field: 'username' }));
    throw e;
  }
  const token = createSession(ctx.db, user.id, now);
  return { status: 201, body: { user: publicUser(user) }, cookie: sessionCookie(token, isHttps(req)) };
}

async function login(req: IncomingMessage, ctx: ApiContext): Promise<Result> {
  const b = objectBody(await readJson(req));
  const ipUser = typeof b.username === 'string' ? b.username.trim().toLowerCase().slice(0, 64) : '';
  const wait = ctx.limiter.retryAfter(ctx.ip, ipUser);
  if (wait) throw new HttpError(429, { error: 'Too many attempts. Try again later.' }, { 'Retry-After': String(wait) });
  const username = checkUsername(b.username);
  const password = typeof b.password === 'string' && b.password.length <= 1024 ? b.password : '';
  const user = username ? findUser(ctx.db, username) : undefined;
  const ok = await verifyPassword(password, user?.pass_hash ?? (await getDummyHash()));
  if (!user || !ok || !password) {
    ctx.limiter.fail(ctx.ip, ipUser);
    throw err(401, INCORRECT);
  }
  ctx.limiter.succeed(ctx.ip, ipUser);
  const token = createSession(ctx.db, user.id, ctx.now());
  return { status: 200, body: { user: publicUser(user) }, cookie: sessionCookie(token, isHttps(req)) };
}

async function logout(req: IncomingMessage, ctx: ApiContext): Promise<Result> {
  await readBody(req);
  if (ctx.session) ctx.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(ctx.session.tokenHash);
  return { status: 204, body: null, cookie: clearCookie(isHttps(req)) };
}

async function patchMe(req: IncomingMessage, ctx: ApiContext): Promise<Result> {
  const s = requireSession(ctx);
  const b = objectBody(await readJson(req));
  const unknown = Object.keys(b).filter((k) => !['displayName', 'currentPassword', 'newPassword'].includes(k));
  if (unknown.length) throw err(400, `Unknown field: ${unknown[0].slice(0, 40)}.`, { field: unknown[0].slice(0, 40) });
  let displayName = s.user.display_name;
  if (b.displayName !== undefined) {
    const d = checkDisplayName(b.displayName);
    if (!d) throw err(400, 'Display name must be 1–30 characters.', { field: 'displayName' });
    displayName = d;
  }
  let passHash = s.user.pass_hash;
  if (b.newPassword !== undefined) {
    if (!checkPassword(b.newPassword)) throw err(400, 'Password must be 8–128 characters.', { field: 'newPassword' });
    if (typeof b.currentPassword !== 'string' || !(await verifyPassword(b.currentPassword, s.user.pass_hash))) {
      throw err(403, 'Current password is incorrect.', { field: 'currentPassword' });
    }
    passHash = await hashPassword(b.newPassword);
  }
  tx(ctx.db, () => {
    ctx.db.prepare('UPDATE users SET display_name = ?, pass_hash = ? WHERE id = ?').run(displayName, passHash, s.user.id);
    // A password change signs out every other session.
    if (passHash !== s.user.pass_hash) {
      ctx.db.prepare('DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?').run(s.user.id, s.tokenHash);
    }
  });
  return { status: 200, body: { user: publicUser({ ...s.user, display_name: displayName, pass_hash: passHash }) } };
}

async function deleteMe(req: IncomingMessage, ctx: ApiContext): Promise<Result> {
  const s = requireSession(ctx);
  const b = objectBody(await readJson(req));
  if (typeof b.password !== 'string' || !(await verifyPassword(b.password, s.user.pass_hash))) {
    throw err(403, 'Password is incorrect.', { field: 'password' });
  }
  ctx.db.prepare('DELETE FROM users WHERE id = ?').run(s.user.id);
  return { status: 204, body: null, cookie: clearCookie(isHttps(req)) };
}

async function putProgress(req: IncomingMessage, ctx: ApiContext): Promise<Result> {
  const s = requireSession(ctx);
  const doc = await readJson(req);
  if (!validateProgress(doc)) throw err(400, `Invalid progress: ${ajvText(validateProgress.errors)}`);
  ctx.db
    .prepare('INSERT INTO progress (user_id, doc, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at')
    .run(s.user.id, JSON.stringify(doc), new Date(ctx.now()).toISOString());
  return { status: 204, body: null };
}

async function putUi(req: IncomingMessage, ctx: ApiContext): Promise<Result> {
  const s = requireSession(ctx);
  const doc = await readJson(req);
  const e = uiStateError(doc);
  if (e) throw err(400, e);
  const json = JSON.stringify(doc);
  if (Buffer.byteLength(json, 'utf8') > MAX_UI_BYTES) throw err(400, 'UI state is larger than 64 KB.');
  ctx.db
    .prepare('INSERT INTO ui_state (user_id, doc, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at')
    .run(s.user.id, json, new Date(ctx.now()).toISOString());
  return { status: 204, body: null };
}

type Handler = (req: IncomingMessage, ctx: ApiContext) => Promise<Result> | Result;

const ROUTES: Record<string, Partial<Record<string, Handler>>> = {
  '/api/auth/signup': { POST: signup },
  '/api/auth/login': { POST: login },
  '/api/auth/logout': { POST: logout },
  '/api/me': {
    GET: (_req, ctx) => ({ status: 200, body: { user: publicUser(requireSession(ctx).user) } }),
    PATCH: patchMe,
    DELETE: deleteMe,
  },
  '/api/progress': {
    GET: (_req, ctx) => ({ status: 200, body: getProgress(ctx.db, requireSession(ctx).user.id) ?? defaultProgress(ctx.now()) }),
    PUT: putProgress,
  },
  '/api/ui': {
    GET: (_req, ctx) => ({ status: 200, body: getUi(ctx.db, requireSession(ctx).user.id) }),
    PUT: putUi,
  },
};

export async function handleApi(req: IncomingMessage, res: ServerResponse, path: string, ctx: ApiContext): Promise<void> {
  const cookies: string[] = [];
  if (ctx.session?.refreshCookie) cookies.push(ctx.session.refreshCookie);
  try {
    const route = ROUTES[path.length > 1 ? path.replace(/\/+$/, '') : path];
    if (!route) throw err(404, 'Not found.');
    const method = req.method === 'HEAD' ? 'GET' : (req.method ?? 'GET');
    const handler = route[method];
    if (!handler) throw new HttpError(405, { error: 'Method not allowed.' }, { Allow: Object.keys(route).join(', ') });
    if (method !== 'GET') checkCsrf(req);
    const r = await handler(req, ctx);
    if (r.cookie) cookies.splice(0, cookies.length, r.cookie);
    sendJson(res, r.status, r.body, cookies.length ? { 'Set-Cookie': cookies } : {});
  } catch (e) {
    if (e instanceof HttpError) {
      // Don't keep reading a huge upload after rejecting it.
      if (e.status === 413 || e.status === 403) res.setHeader('Connection', 'close');
      sendJson(res, e.status, e.body, { ...e.headers, ...(cookies.length ? { 'Set-Cookie': cookies } : {}) });
    } else {
      console.error('[aip-server] API error', e);
      sendJson(res, 500, { error: 'Internal server error.' });
    }
  }
}
