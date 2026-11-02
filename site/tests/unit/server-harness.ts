// Shared harness for tests/unit/server-*.test.ts: in-process app on an ephemeral port, temp DB + fake dist.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, request, type IncomingHttpHeaders, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createApp, type App } from '../../server/app';

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

export async function startHarness(): Promise<Harness> {
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
  const app = createApp({ dbPath, distDir: dist, now: () => clock.t });
  const server: Server = createServer(app.handler);
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
      app.close();
      rmSync(root, { recursive: true, force: true });
    },
  };
}
