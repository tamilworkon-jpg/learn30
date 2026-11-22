// Shared harness for tests/unit/server-*.test.ts: in-process app on an ephemeral port, temp DB + fake dist.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createApp, type App, type AppOptions } from '../../server/app';

const page = (title: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1></body></html>`;

export const FAKE_DIST: Record<string, string> = {
  'index.html': page('Dashboard'),
  'settings/index.html': page('Settings'),
  'mock/1/index.html': page('Mock 1'),
  'day/1/index.html': page('Day 1'),
  'login/index.html': page('Login'),
  'signup/index.html': page('Signup'),
  'glossary/index.html': page('Glossary'),
  'admin/index.html': page('Admin'),
  // Learn30: course pages live under /course/<id>/… (old root pages above are 301 legacy addresses).
  'course/aws-ai-practitioner/index.html': page('Course dashboard'),
  'course/aws-ai-practitioner/glossary/index.html': page('Course glossary'),
  'course/aws-ai-practitioner/day/01/index.html': page('Course day 1'),
  'course/aws-ai-practitioner/mock/1/index.html': page('Course mock 1'),
  '404.html': page('Not found'),
  '_astro/app.abc123.css': 'body{color:red}',
  'scripts/ui-prefs.js': 'void 0;',
  'favicon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
  'fonts/poppins.woff2': 'wOF2',
  'pagefind/pagefind.js': 'export {};',
};

export interface Res {
  status: number;
  headers: IncomingHttpHeaders;
  text: string;
  json: () => unknown;
}

export interface Harness {
  base: string;
  port: number;
  root: string;
  dbPath: string;
  clock: { t: number };
  app: App;
  /** Raw HTTP request (path is sent verbatim, so traversal attempts are not normalised away). */
  req(method: string, path: string, opts?: { headers?: Record<string, string>; body?: unknown; raw?: string | Buffer; cookie?: string }): Promise<Res>;
  /** JSON API call with the CSRF header + JSON content type. */
  api(method: string, path: string, body?: unknown, cookie?: string, headers?: Record<string, string>): Promise<Res>;
  signup(username: string, password?: string, displayName?: string): Promise<{ cookie: string; res: Res }>;
  close(): Promise<void>;
}

export function cookieOf(res: Res): string {
  const sc = res.headers['set-cookie'] ?? [];
  const c = sc.find((x) => x.startsWith('aip_session='));
  if (!c) throw new Error(`no session cookie (status ${res.status}): ${res.text}`);
  return c.split(';')[0];
}

/** scrypt cost used by the harness (fast); production uses SCRYPT_N = 2^17. */
export const TEST_SCRYPT_N = 2 ** 11;

/**
 * Requests come from 127.0.0.1 (a loopback peer). The harness trusts X-Forwarded-For from loopback, so a test
 * can act as a remote client by sending `X-Forwarded-For: <ip>`. Sign-up / account caps are generous unless overridden.
 */
export async function startHarness(opts: Partial<Omit<AppOptions, 'dbPath' | 'db' | 'distDir' | 'now'>> = {}): Promise<Harness> {
  const root = mkdtempSync(join(tmpdir(), 'aip-server-'));
  const dist = join(root, 'dist');
  for (const [rel, content] of Object.entries(FAKE_DIST)) {
    mkdirSync(dirname(join(dist, rel)), { recursive: true });
    writeFileSync(join(dist, rel), content);
  }
  writeFileSync(join(root, 'package.json'), '{"secret":"outside-dist"}');
  writeFileSync(join(root, 'secret.txt'), 'outside-dist');
  const dbPath = join(root, 'data', 'test.db');
  const clock = { t: Date.parse('2026-11-02T10:00:00.000Z') };
  // AIP_TEST_LIBSQL=1 runs the same suite through the libSQL client (the adapter used with Turso on Vercel).
  const db = process.env.AIP_TEST_LIBSQL === '1' ? { url: 'file:' + dbPath.replace(/\\/g, '/') } : { path: dbPath };
  mkdirSync(dirname(dbPath), { recursive: true });
  const app = createApp({
    db,
    distDir: dist,
    now: () => clock.t,
    scryptN: TEST_SCRYPT_N,
    maxUsers: 10_000,
    trustProxy: true,
    ...opts,
    limits: { signupsPerHour: 10_000, ...opts.limits },
  });
  await app.ready;
  const server: Server = createServer((rq, rs) => void app.handler(rq, rs));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const port = (server.address() as AddressInfo).port;

  const req: Harness['req'] = (method, path, opts = {}) =>
    new Promise((resolve, reject) => {
      const payload = opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
      const headers: Record<string, string | number> = { ...opts.headers };
      if (opts.cookie) headers.Cookie = opts.cookie;
      if (payload !== undefined) headers['Content-Length'] = Buffer.byteLength(payload);
      const r = request({ host: '127.0.0.1', port, method, path, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode ?? 0, headers: res.headers, text, json: () => JSON.parse(text) });
        });
      });
      r.on('error', reject);
      r.end(payload);
    });

  const api: Harness['api'] = (method, path, body, cookie, headers = {}) =>
    req(method, path, {
      body,
      cookie,
      headers: { 'X-AIP-Request': '1', ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    });

  const signup: Harness['signup'] = async (username, password = 'correct horse', displayName) => {
    const res = await api('POST', '/api/auth/signup', { username, password, ...(displayName !== undefined ? { displayName } : {}) });
    return { cookie: cookieOf(res), res };
  };

  return {
    base: `http://127.0.0.1:${port}`,
    port,
    root,
    dbPath,
    clock,
    app,
    req,
    api,
    signup,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
      await app.close();
      try {
        rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      } catch (e) {
        // The native libSQL driver can hold the file on Windows until the process exits; leave the temp dir.
        if (process.env.AIP_TEST_LIBSQL !== '1') throw e;
      }
    },
  };
}
