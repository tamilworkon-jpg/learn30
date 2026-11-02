import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { isAuthPage, requiresSignIn, routeOf, safeNext } from './access';
import { getProgress, getUi, handleApi, sendJson } from './api';
import { getSession, publicUser, purgeExpiredSessions, RateLimiter, type Session } from './auth';
import { openDb } from './db';
import { findFile, safePath, sendAsset, sendHtml } from './static';

export interface AppOptions {
  dbPath: string;
  distDir: string;
  /** Clock override for tests (ms since epoch). */
  now?: () => number;
}

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
  const limiter = new RateLimiter(now);
  purgeExpiredSessions(db, now());
  let lastPurge = now();

  function bootstrap(session: Session | null) {
    if (!session) return { user: null, progress: null, ui: null };
    return { user: publicUser(session.user), progress: getProgress(db, session.user.id), ui: getUi(db, session.user.id) };
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
    if (now() - lastPurge > 60 * 60 * 1000) {
      purgeExpiredSessions(db, now());
      lastPurge = now();
    }
    const rawUrl = req.url ?? '/';
    const qIndex = rawUrl.indexOf('?');
    const rawPath = qIndex < 0 ? rawUrl : rawUrl.slice(0, qIndex);
    const search = qIndex < 0 ? '' : rawUrl.slice(qIndex);

    if (rawPath === '/api' || rawPath.startsWith('/api/')) {
      const session = getSession(db, req, now());
      await handleApi(req, res, rawPath, { db, limiter, now, session, ip: req.socket.remoteAddress ?? '' });
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
      sendHtml(req, res, 200, file.path, bootstrap(session));
      return;
    }
    const page404 = join(dist, '404.html');
    if (existsSync(page404)) sendHtml(req, res, 404, page404, bootstrap(session));
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
