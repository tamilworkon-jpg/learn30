import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { isAuthPage, legacyRedirect, requiresSignIn, routeOf, safeNext } from './access';
import { ensureProgress, getSummary, getUi, handleApi, sendJson } from './api';
import { courseIdFromPath } from '../src/lib/routes';
import { loadCourseIds } from './courses';
import { clientOf, DEFAULT_LIMITS, getSession, publicUser, purgeExpiredSessions, RateLimiter, SCRYPT_N, type Limits, type Session } from './auth';
import { DEFAULT_COURSE_ID, openDb } from './db';
import { findFile, safePath, sendAsset, sendHtml } from './static';

export interface AppOptions {
  dbPath: string;
  distDir: string;
  /** Clock override for tests (ms since epoch). */
  now?: () => number;
  /** Maximum number of accounts (AIP_MAX_USERS, default 50). */
  maxUsers?: number;
  /** Rate-limit overrides (AIP_SIGNUPS_PER_HOUR; tests). */
  limits?: Partial<Limits>;
  /** Key loopback peers on their X-Forwarded-For address (AIP_TRUST_PROXY=1). */
  trustProxy?: boolean;
  /** scrypt cost for new hashes (default 2^17; tests use less). */
  scryptN?: number;
  /** Known course ids (default: the registry, see server/courses.ts). */
  courseIds?: string[];
}

export const DEFAULT_MAX_USERS = 50;

export interface App {
  handler: RequestListener;
  close(): void;
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
  const db = openDb(opts.dbPath);
  const dist = resolve(opts.distDir);
  const limiter = new RateLimiter(now, { ...DEFAULT_LIMITS, ...opts.limits });
  const maxUsers = opts.maxUsers ?? DEFAULT_MAX_USERS;
  const scryptN = opts.scryptN ?? SCRYPT_N;
  const trustProxy = opts.trustProxy ?? false;
  const courseIds = opts.courseIds ?? loadCourseIds();
  purgeExpiredSessions(db, now());
  let lastPurge = now();

  /**
   * Per-page bootstrap (spec 002 progress-api-v2): `course` on /course/<id>/… pages, `summary` on global
   * pages. `progress` (= the page's course, or the first course on global pages) stays for clients that
   * predate Learn30.
   */
  function bootstrap(session: Session | null, path: string) {
    if (!session) return { user: null, progress: null, ui: null, course: null, summary: null };
    const uid = session.user.id;
    const fromPath = courseIdFromPath(path);
    const id = fromPath && courseIds.includes(fromPath) ? fromPath : null;
    // The page's course (first course on global / pre-Learn30 pages) — created on first visit.
    const progress = ensureProgress(db, uid, id ?? DEFAULT_COURSE_ID, now());
    return {
      user: publicUser(session.user),
      ui: getUi(db, uid),
      progress,
      course: id ? { id, progress } : null,
      summary: id ? null : getSummary(db, uid),
    };
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    if (now() - lastPurge > 60 * 60 * 1000) {
      purgeExpiredSessions(db, now());
      limiter.sweep();
      lastPurge = now();
    }
    const rawUrl = req.url ?? '/';
    const qIndex = rawUrl.indexOf('?');
    const rawPath = qIndex < 0 ? rawUrl : rawUrl.slice(0, qIndex);
    const search = qIndex < 0 ? '' : rawUrl.slice(qIndex);

    if (rawPath === '/api' || rawPath.startsWith('/api/')) {
      const session = getSession(db, req, now());
      await handleApi(req, res, rawPath, { db, limiter, now, session, client: clientOf(req, trustProxy), scryptN, maxUsers, courseIds });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      notFoundText(res, 405, 'Method not allowed');
      return;
    }

    const path = safePath(rawPath);
    if (path === null) {
      notFoundText(res);
      return;
    }
    const route = routeOf(path);
    const file = findFile(dist, path);
    const isHtml = !file || file.path.toLowerCase().endsWith('.html');
    if (file && !isHtml) {
      sendAsset(req, res, file, path);
      return;
    }

    const moved = legacyRedirect(route);
    if (moved) {
      res.writeHead(301, { Location: moved + search, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    // HTML (or 404): resolve the session for access rules + bootstrap.
    const session = getSession(db, req, now());
    const refresh = session?.refreshCookie ?? null;
    if (refresh) res.setHeader('Set-Cookie', refresh);
    if (!session && requiresSignIn(route)) {
      redirect(res, `/login?next=${encodeURIComponent(path + search)}`, null);
      return;
    }
    if (session && isAuthPage(route)) {
      redirect(res, safeNext(new URLSearchParams(search).get('next')), refresh);
      return;
    }
    if (file) {
      sendHtml(req, res, 200, file.path, bootstrap(session, path));
      return;
    }
    const page404 = join(dist, '404.html');
    if (existsSync(page404)) sendHtml(req, res, 404, page404, bootstrap(session, path));
    else notFoundText(res);
  }

  return {
    handler(req, res) {
      handle(req, res).catch((e: unknown) => {
        console.error('[aip-server] request error', e);
        if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error.' });
        else res.destroy();
      });
    },
    close() {
      db.close();
    },
  };
}
