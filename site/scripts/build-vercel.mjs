// Vercel deployment (Build Output API v3): turns the built site (dist/) + the Node server into .vercel/output/.
//   static/                 every asset except HTML (served by Vercel's CDN)
//   functions/index.func/   the server (server/vercel.ts bundled with esbuild) + dist's HTML pages, so every page
//                           still gets the access rules and the per-page bootstrap, exactly like `npm start`
//   config.json             routes: headers → static files → everything else to the function
// Run after `npm run build` (npm run build:vercel does both). See README → "Deploy to Vercel".
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from 'js-yaml';
/* global console, process */

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(site, 'dist');
const out = join(site, '.vercel', 'output');
const func = join(out, 'functions', 'index.func');
const DEFAULT_COURSE_ID = 'aws-ai-practitioner';

if (!existsSync(join(dist, 'index.html'))) {
  console.error('[build-vercel] dist/ is missing: run `npm run build` first (or `npm run build:vercel`).');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, 'static'), { recursive: true });
mkdirSync(func, { recursive: true });

// 1. Split dist/: HTML → the function, everything else → static/.
let html = 0;
let assets = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    const rel = relative(dist, p);
    const target = p.toLowerCase().endsWith('.html') ? join(func, 'dist', rel) : join(out, 'static', rel);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(p, target);
    if (target.startsWith(func)) html++;
    else assets++;
  }
}
walk(dist);

// 2. Course ids from the registry (same rules as server/courses.ts), baked into the bundle.
const registry = load(readFileSync(join(site, 'src', 'data', 'courses.yaml'), 'utf8'));
const courseIds = [
  ...new Set([
    DEFAULT_COURSE_ID,
    ...(Array.isArray(registry) ? registry : []).map((c) => c?.id).filter((id) => typeof id === 'string' && /^[a-z0-9-]{1,60}$/.test(id)),
  ]),
];

// 3. Bundle the server into one ES module (no node_modules in the function).
await build({
  entryPoints: [join(site, 'server', 'vercel.ts')],
  outfile: join(func, 'index.mjs'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: 'linked',
  legalComments: 'none',
  logLevel: 'warning',
  define: { __AIP_COURSE_IDS__: JSON.stringify(courseIds) },
  // Bundled CommonJS dependencies may call require() for Node built-ins.
  banner: { js: "import { createRequire as __aipCreateRequire } from 'node:module'; const require = __aipCreateRequire(import.meta.url);" },
});

writeFileSync(
  join(func, '.vc-config.json'),
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.mjs',
      launcherType: 'Nodejs',
      shouldAddHelpers: false,
      supportsResponseStreaming: false,
      maxDuration: 30,
    },
    null,
    2,
  ),
);

// 4. Routing: security headers everywhere, long caching for hashed /_astro/* files, then static files, then the function.
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'interest-cohort=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
};
writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/(.*)$', headers: securityHeaders, continue: true },
        { src: '^/_astro/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
        { handle: 'filesystem' },
        { src: '^/(.*)$', dest: '/index' },
      ],
    },
    null,
    2,
  ),
);

console.log(`[build-vercel] .vercel/output ready: ${assets} static assets, ${html} HTML pages in the function, courses: ${courseIds.join(', ')}`);
