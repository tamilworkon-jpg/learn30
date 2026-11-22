import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { isAdminPage, isAuthPage, legacyRedirect, requiresSignIn, routeOf, safeNext } from './access';
import { ensureProgress, getSummary, getUi, handleApi, sendJson } from './api';
import { ensureAdminAccount } from './admin';
import { courseIdFromPath } from '../src/lib/routes';
import { loadCourseIds } from './courses';
import { clientOf, DEFAULT_LIMITS, getSession, publicUser, purgeExpiredSessions, RateLimiter, SCRYPT_N, type Limits, type Session } from './auth';
import { DEFAULT_COURSE_ID, openDb, type Db, type DbSpec } from './db';
import { findFile, safePath, sendAsset, sendHtml } from './static';

export interface AppOptions {
  /** Local SQLite file (AIP_DB). Ignored when `db` is given. */
  dbPath?: string;
  /** Database connection (local file or libSQL / Turso URL). */
  db?: DbSpec;
  distDir: string;
  /** Clock override for tests (ms since epoch). */
  now?: () => number;
  /** Maximum number of accounts (AIP_MAX_USERS, default 50). */
  maxUsers?: number;
  /** Rate-limit overrides (AIP_SIGNUPS_PER_HOUR; tests). */
  limits?: Partial<Limits>;
  /** Key loopback peers on their X-Forwarded-For address (AIP_TRUST_PROXY=1). */
  trustProxy?: boolean;
  /** Take the client IP from this header set by the hosting platform (Vercel: x-real-ip). */
  ipHeader?: string;
  /** scrypt cost for new hashes (default 2^17; tests use less). */
  scryptN?: number;
  /** Known course ids (default: the registry, see server/courses.ts). */
  courseIds?: string[];
  /** Public sign-up (AIP_SIGNUP=open|closed). Default true; when false only admins create accounts. */
  allowSignup?: boolean;
  /** First admin account, created or promoted at start-up (AIP_ADMIN_USERNAME / AIP_ADMIN_PASSWORD). */
  admin?: { username: string; password: string };
}

export const DEFAULT_MAX_USERS = 50;

export interface App {
  handler(req: IncomingMessage, res: ServerResponse): Promise<void>;
  /** Resolves once the database is open and migrated (rejects when it cannot be). */
  ready: Promise<void>;
  close(): Promise<void>;
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'interest-cohort=()',
};

function redirect(res: ServerResponse, location: string, cookie: string | null): void {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store', ...(cookie ? { 'Set-Cookie': cookie } : {}) });
  res.end();
}

function notFoundText(res: ServerResponse, status = 404, msg = 'Not found'): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(msg);
}

export function createApp(opts: AppOptions): App {
  const now = opts.now ?? Date.now;
  const dist = resolve(opts.distDir);
  const limiter = new RateLimiter(now, { ...DEFAULT_LIMITS, ...opts.limits });
  const maxUsers = opts.maxUsers ?? DEFAULT_MAX_USERS;
  const scryptN = opts.scryptN ?? SCRYPT_N;
  const trustProxy = opts.trustProxy ?? false;
  const allowSignup = opts.allowSignup ?? true;
  const courseIds = opts.courseIds ?? loadCourseIds();
  const spec: DbSpec = opts.db ?? { path: opts.dbPath };
  let lastPurge = now();

  const opened: Promise<Db> = (async () => {
    const db = await openDb(spec);
    try {
      if (opts.admin) await ensureAdminAccount(db, opts.admin.username, opts.admin.password, scryptN, now());
      await purgeExpiredSessions(db, now());
    } catch (e) {
      await db.close();
      throw e;
    }
    return db;
  })();
  const ready = opened.then(() => undefined);
  // Callers that never await `ready` still see the error on their first request; avoid an unhandled rejection.
  ready.catch(() => {});

  /**
   * Per-page bootstrap (spec 002 progress-api-v2): `course` on /course/<id>/… pages, `summary` on global
   * pages. `progress` (= the page's course, or the first course on global pages) stays for clients that
   * predate Learn30. `site` describes the server (public sign-up open or not) for signed-out pages too.
   */
  async function bootstrap(db: Db, session: Session | null, path: string) {
    const site = { signup: allowSignup };
    if (!session) return { user: null, progress: null, ui: null, course: null, summary: null, site };
    const uid = session.user.id;
    const fromPath = courseIdFromPath(path);
    const id = fromPath && courseIds.includes(fromPath) ? fromPath : null;
    // The page's course (first course on global / pre-Learn30 pages) — created on first visit.
    const progress = await ensureProgress(db, uid, id ?? DEFAULT_COURSE_ID, now());
    return {
      user: publicUser(session.user),
      ui: await getUi(db, uid),
      progress,
      course: id ? { id, progress } : null,
      summary: id ? null : await getSummary(db, uid),
      site,
    };
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    const rawUrl = req.url ?? '/';
    const qIndex = rawUrl.indexOf('?');
    const rawPath = qIndex < 0 ? rawUrl : rawUrl.slice(0, qIndex);
    const search = qIndex < 0 ? '' : rawUrl.slice(qIndex);
    const isApi = rawPath === '/api' || rawPath.startsWith('/api/');

    // Static assets never need the database: serve them before waiting for it.
    let path: string | null = null;
    let file: ReturnType<typeof findFile> = null;
    if (!isApi && (req.method === 'GET' || req.method === 'HEAD')) {
      path = safePath(rawPath);
      if (path === null) {
        notFoundText(res);
        return;
      }
      file = findFile(dist, path);
      if (file && !file.path.toLowerCase().endsWith('.html')) {
        sendAsset(req, res, file, path);
        return;
      }
    }

    const db = await opened;
    if (now() - lastPurge > 60 * 60 * 1000) {
      lastPurge = now();
      await purgeExpiredSessions(db, now());
      limiter.sweep();
    }

    if (isApi) {
      const session = await getSession(db, req, now());
      await handleApi(req, res, rawPath, {
        db,
        limiter,
        now,
        session,
        client: clientOf(req, trustProxy, opts.ipHeader),
        scryptN,
        maxUsers,
        courseIds,
        allowSignup,
      });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      notFoundText(res, 405, 'Method not allowed');
      return;
    }
    if (path === null) {
      notFoundText(res);
      return;
    }
    const route = routeOf(path);

    const moved = legacyRedirect(route);
    if (moved) {
      res.writeHead(301, { Location: moved + search, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    // HTML (or 404): resolve the session for access rules + bootstrap.
    const session = await getSession(db, req, now());
    const refresh = session?.refreshCookie ?? null;
    if (refresh) res.setHeader('Set-Cookie', refresh);
    if (!allowSignup && route === '/signup' && !session) {
      redirect(res, '/login' + search, null);
      return;
    }
    if (!session && requiresSignIn(route)) {
      redirect(res, `/login?next=${encodeURIComponent(path + search)}`, null);
      return;
    }
    if (session && isAuthPage(route)) {
      redirect(res, safeNext(new URLSearchParams(search).get('next')), refresh);
      return;
    }
    // Non-admins cannot tell the admin console exists.
    if (file && !(isAdminPage(route) && !session?.user.is_admin)) {
      sendHtml(req, res, 200, file.path, await bootstrap(db, session, path));
      return;
    }
    const page404 = join(dist, '404.html');
    if (existsSync(page404)) sendHtml(req, res, 404, page404, await bootstrap(db, session, path));
    else notFoundText(res);
  }

  return {
    ready,
    async handler(req, res) {
      try {
        await handle(req, res);
      } catch (e: unknown) {
        console.error('[aip-server] request error', e);
        if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error.' });
        else res.destroy();
      }
    },
    async close() {
      const db = await opened.catch(() => null);
      await db?.close();
    },
  };
}
