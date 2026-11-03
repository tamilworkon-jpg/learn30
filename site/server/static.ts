import { readFileSync, statSync, type Stats } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.pf_meta': 'application/octet-stream',
  '.pf_index': 'application/octet-stream',
  '.pf_fragment': 'application/octet-stream',
  '.pagefind': 'application/octet-stream',
};

/**
 * Decode a URL pathname into a safe, `/`-separated path, or null when it is malformed or could
 * escape / alias files: `..` segments, backslashes, NUL, drive colons, and segments ending in a dot
 * or space (Windows strips those, which would alias e.g. `/settings.` to `/settings`), and Windows device
 * names (`/con`, `/nul.txt`). Repeated slashes are collapsed.
 */
/** Windows reserved device names (with any extension) open devices instead of files. */
const WINDOWS_DEVICE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function safePath(rawPathname: string): string | null {
  let p: string;
  try {
    p = decodeURIComponent(rawPathname);
  } catch {
    return null;
  }
  if (!p.startsWith('/') || /[\\\0:]/.test(p)) return null;
  // `//settings` must not dodge the access rules for `/settings`.
  p = p.replace(/\/{2,}/g, '/');
  for (const seg of p.split('/')) {
    if (seg === '.' || seg === '..' || /[. ]$/.test(seg) || WINDOWS_DEVICE.test(seg)) return null;
  }
  return p;
}

export interface StaticFile {
  path: string;
  stat: Stats;
}

/** Map a safe path to a file inside `root` (directory → index.html). Prefix-checked after resolving. */
export function findFile(root: string, p: string): StaticFile | null {
  const base = resolve(root);
  const candidates = p.endsWith('/') ? [p + 'index.html'] : [p, p + '/index.html'];
  for (const c of candidates) {
    const full = resolve(base, '.' + c);
    if (full !== base && !full.startsWith(base + sep)) return null;
    try {
      const stat = statSync(full);
      if (stat.isFile()) return { path: full, stat };
    } catch {
      /* try next */
    }
  }
  return null;
}

export function contentType(file: string): string {
  return TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/** JSON that is safe inside a `<script type="application/json">` element. */
export function scriptSafeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function injectBootstrap(html: string, data: unknown): string {
  const tag = `<script type="application/json" id="aip-bootstrap">${scriptSafeJson(data)}</script>`;
  const i = html.search(/<\/head>/i);
  return i < 0 ? tag + html : html.slice(0, i) + tag + html.slice(i);
}

export function sendHtml(req: IncomingMessage, res: ServerResponse, status: number, file: string, bootstrap: unknown): void {
  const body = Buffer.from(injectBootstrap(readFileSync(file, 'utf8'), bootstrap), 'utf8');
  res.writeHead(status, {
    'Content-Type': TYPES['.html'],
    'Content-Length': body.length,
    'Cache-Control': 'no-store',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

export function sendAsset(req: IncomingMessage, res: ServerResponse, f: StaticFile, urlPath: string): void {
  const etag = `W/"${f.stat.size.toString(16)}-${Math.floor(f.stat.mtimeMs).toString(16)}"`;
  const lastModified = f.stat.mtime.toUTCString();
  const headers: Record<string, string | number> = {
    'Content-Type': contentType(f.path),
    ETag: etag,
    'Last-Modified': lastModified,
    // Astro's /_astro/* files are content-hashed; everything else revalidates.
    'Cache-Control': urlPath.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  };
  const inm = req.headers['if-none-match'];
  const ims = req.headers['if-modified-since'];
  const notModified = inm
    ? inm.split(',').some((t) => t.trim() === etag || t.trim() === '*')
    : ims
      ? Math.floor(f.stat.mtimeMs / 1000) <= Math.floor(Date.parse(ims) / 1000)
      : false;
  if (notModified) {
    res.writeHead(304, headers);
    res.end();
    return;
  }
  const body = readFileSync(f.path);
  res.writeHead(200, { ...headers, 'Content-Length': body.length });
  res.end(req.method === 'HEAD' ? undefined : body);
}
