// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startHarness, type Harness, type Res } from './server-harness';

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

function bootstrapOf(res: Res): unknown {
  const m = /<script type="application\/json" id="aip-bootstrap">(.*?)<\/script><\/head>/s.exec(res.text);
  if (!m) throw new Error('no bootstrap before </head>: ' + res.text);
  return JSON.parse(m[1]);
}

function expectSecurityHeaders(r: Res) {
  expect(r.headers['x-content-type-options']).toBe('nosniff');
  expect(r.headers['referrer-policy']).toBe('same-origin');
  expect(r.headers['x-frame-options']).toBe('DENY');
  expect(r.headers['permissions-policy']).toBe('interest-cohort=()');
}

describe('SV5 static serving (T188)', () => {
  it('serves HTML with directory index, no-store and security headers', async () => {
    for (const p of ['/day/1', '/day/1/', '/day/1/index.html', '/course/aws-ai-practitioner/glossary']) {
      const r = await h.req('GET', p);
      expect(r.status, p).toBe(200);
      expect(r.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(r.headers['cache-control']).toBe('no-store');
      expectSecurityHeaders(r);
    }
    expect((await h.req('GET', '/day/1')).text).toContain('<h1>Day 1</h1>');
  });

  it('content types, ETag/Last-Modified and 304 for assets', async () => {
    const types: Record<string, string> = {
      '/_astro/app.abc123.css': 'text/css; charset=utf-8',
      '/scripts/ui-prefs.js': 'text/javascript; charset=utf-8',
      '/favicon.svg': 'image/svg+xml',
      '/fonts/poppins.woff2': 'font/woff2',
      '/pagefind/pagefind.js': 'text/javascript; charset=utf-8',
    };
    for (const [p, t] of Object.entries(types)) {
      const r = await h.req('GET', p);
      expect(r.status, p).toBe(200);
      expect(r.headers['content-type'], p).toBe(t);
      expect(r.headers.etag).toBeTruthy();
      expect(r.headers['last-modified']).toBeTruthy();
      expectSecurityHeaders(r);
      expect(r.text).not.toContain('aip-bootstrap');
    }
    const first = await h.req('GET', '/_astro/app.abc123.css');
    expect(first.headers['cache-control']).toContain('immutable');
    const again = await h.req('GET', '/_astro/app.abc123.css', { headers: { 'If-None-Match': first.headers.etag! } });
    expect(again.status).toBe(304);
    expect(again.text).toBe('');
  });

  it('unknown path → 404 page (with bootstrap) and security headers', async () => {
    const r = await h.req('GET', '/does/not/exist');
    expect(r.status).toBe(404);
    expect(r.text).toContain('<h1>Not found</h1>');
    expect(bootstrapOf(r)).toEqual({ user: null, progress: null, ui: null });
    expectSecurityHeaders(r);
  });

  it('path traversal is impossible (encoded dots, encoded slashes, backslashes, NUL)', async () => {
    const attempts = [
      '/../package.json',
      '/%2e%2e/package.json',
      '/%2E%2E/secret.txt',
      '/..%2fpackage.json',
      '/..%2Fsecret.txt',
      '/day/..%2f..%2fpackage.json',
      '/%2e%2e%2fsecret.txt',
      '/..\\package.json',
      '/..%5cpackage.json',
      '/day/1/..%5c..%5c..%5csecret.txt',
      '/secret.txt%00.html',
      '/C:/Windows/win.ini',
      '/%2e%2e/%2e%2e/%2e%2e/etc/passwd',
      '//etc/passwd',
    ];
    for (const p of attempts) {
      const r = await h.req('GET', p);
      expect(r.status, p).toBe(404);
      expect(r.text, p).not.toContain('outside-dist');
      expectSecurityHeaders(r);
    }
  });

  it('non-GET on pages → 405', async () => {
    expect((await h.req('POST', '/day/1')).status).toBe(405);
  });

  it('HEAD returns headers without a body', async () => {
    const r = await h.req('HEAD', '/day/1');
    expect(r.status).toBe(200);
    expect(r.text).toBe('');
  });
});

describe('SV6 bootstrap injection + escaping (T188)', () => {
  it('signed out → {user:null,progress:null,ui:null} immediately before </head>', async () => {
    const r = await h.req('GET', '/day/1');
    expect(r.text).toContain('<script type="application/json" id="aip-bootstrap">{"user":null,"progress":null,"ui":null}</script></head>');
  });

  it('signed in → user, progress and ui; a hostile display name cannot break out of the element', async () => {
    // Display names are capped at 30 chars: the hostile part that fits, plus U+2028 and '&'.
    const name = '</script><script>alert(1)\u2028&';
    const { cookie } = await h.signup('mallory', 'password123', name);
    await h.api('PUT', '/api/ui', { lessonView: 'full' }, cookie);
    const r = await h.req('GET', '/day/1', { cookie });
    expect(r.status).toBe(200);
    const head = r.text.slice(0, r.text.indexOf('</head>'));
    // Exactly one </script> (the bootstrap's own) and only our <script> open tag.
    expect(head.match(/<\/script/gi)).toHaveLength(1);
    expect(head.match(/<script/gi)).toHaveLength(1);
    expect(head).not.toContain('\u2028');
    expect(head).toContain('\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u2028\\u0026');
    const data = bootstrapOf(r) as { user: { displayName: string; username: string }; progress: { schemaVersion: number }; ui: unknown };
    expect(data.user.displayName).toBe(name);
    expect(data.user.username).toBe('mallory');
    expect(data.progress.schemaVersion).toBe(1);
    expect(data.ui).toEqual({ lessonView: 'full' });
  });

  it('a full </script><script>alert(1)</script> display name is rejected or escaped (never raw)', async () => {
    const full = '</script><script>alert(1)</script>';
    const res = await h.api('POST', '/api/auth/signup', { username: 'mallory2', password: 'password123', displayName: full.slice(0, 30) });
    expect(res.status).toBe(201);
    const cookie = res.headers['set-cookie']![0].split(';')[0];
    const r = await h.req('GET', '/course/aws-ai-practitioner/glossary', { cookie });
    expect(r.text).not.toContain(full.slice(0, 30));
    expect((bootstrapOf(r) as { user: { displayName: string } }).user.displayName).toBe(full.slice(0, 30));
  });
});

describe('SV7 page access (T188)', () => {
  it('protected pages redirect signed-out visitors to /login?next=<path>', async () => {
    const cases: Record<string, string> = {
      // T205: `/` is the public course catalogue; the course dashboard is protected.
      '/course/aws-ai-practitioner': '/login?next=%2Fcourse%2Faws-ai-practitioner',
      '/course/aws-ai-practitioner/index.html': '/login?next=%2Fcourse%2Faws-ai-practitioner%2Findex.html',
      '/COURSE/aws-ai-practitioner/': '/login?next=%2FCOURSE%2Faws-ai-practitioner%2F',
      '/settings': '/login?next=%2Fsettings',
      '/settings/': '/login?next=%2Fsettings%2F',
      '/SETTINGS': '/login?next=%2FSETTINGS',
      '/course/aws-ai-practitioner/mock/1?x=1': '/login?next=%2Fcourse%2Faws-ai-practitioner%2Fmock%2F1%3Fx%3D1',
    };
    for (const [p, loc] of Object.entries(cases)) {
      const r = await h.req('GET', p);
      expect(r.status, p).toBe(302);
      expect(r.headers.location, p).toBe(loc);
      expectSecurityHeaders(r);
    }
  });

  it('public pages are served signed out', async () => {
    for (const p of ['/day/1', '/course/aws-ai-practitioner/glossary', '/course/aws-ai-practitioner/day/01', '/login', '/signup']) expect((await h.req('GET', p)).status, p).toBe(200);
  });

  it('signed in: protected pages served; /login and /signup → / or a safe next', async () => {
    const { cookie } = await h.signup('nina', 'password123');
    const home = await h.req('GET', '/', { cookie });
    expect(home.status).toBe(200);
    expect(home.text).toContain('<h1>Dashboard</h1>');
    expect((await h.req('GET', '/settings', { cookie })).status).toBe(200);
    expect((await h.req('GET', '/course/aws-ai-practitioner/mock/1', { cookie })).status).toBe(200);
    expect((await h.req('GET', '/course/aws-ai-practitioner', { cookie })).status).toBe(200);
    const cases: Record<string, string> = {
      '/login': '/',
      '/signup': '/',
      '/login?next=%2Fday%2F1%3Fa%3D1': '/day/1?a=1',
      '/login?next=%2Fsettings': '/settings',
      '/login?next=https%3A%2F%2Fevil.example': '/',
      '/login?next=%2F%2Fevil.example': '/',
      '/login?next=%2F%5Cevil.example': '/',
      '/login?next=%2Flogin': '/',
    };
    for (const [p, loc] of Object.entries(cases)) {
      const r = await h.req('GET', p, { cookie });
      expect(r.status, p).toBe(302);
      expect(r.headers.location, p).toBe(loc);
    }
  });
});

describe('T192 hardening — redirects and paths', () => {
  it('H1: next values that normalise to a protocol-relative URL fall back to /', async () => {
    const { cookie } = await h.signup('olive', 'password123');
    for (const next of ['/..//evil.com', '/.//evil.com', '/a/%2e%2e//evil.com', '/a/..//evil.com/x', '/%2e%2e//evil.com', '/a/../\\evil.com']) {
      const r = await h.req('GET', `/login?next=${encodeURIComponent(next)}`, { cookie });
      expect(r.status, next).toBe(302);
      expect(r.headers.location, next).toBe('/');
    }
  });

  it('H1: safeNext unit cases', async () => {
    const { safeNext } = await import('../../server/access');
    expect(safeNext('/..//evil.com')).toBe('/');
    expect(safeNext('/.//evil.com')).toBe('/');
    expect(safeNext('/a/%2e%2e//evil.com')).toBe('/');
    expect(safeNext('/day/02?x=1#s')).toBe('/day/02?x=1#s');
    expect(safeNext('/a/../day/02')).toBe('/day/02');
  });

  it('L3: repeated slashes cannot bypass the access rules', async () => {
    for (const [p, loc] of [
      ['//settings', '/login?next=%2Fsettings'],
      ['///settings/', '/login?next=%2Fsettings%2F'],
      ['/course/aws-ai-practitioner/mock//1', '/login?next=%2Fcourse%2Faws-ai-practitioner%2Fmock%2F1'],
      ['//course//aws-ai-practitioner', '/login?next=%2Fcourse%2Faws-ai-practitioner'],
    ]) {
      const r = await h.req('GET', p);
      expect(r.status, p).toBe(302);
      expect(r.headers.location, p).toBe(loc);
    }
    expect((await h.req('GET', '//day//1')).status).toBe(200);
  });

  it('T205: the catalogue (/) is public; the old /courses address redirects there (301, query kept)', async () => {
    expect((await h.req('GET', '/')).status).not.toBe(302);
    const r = await h.req('GET', '/courses?x=1');
    expect(r.status).toBe(301);
    expect(r.headers.location).toBe('/?x=1');
    expect((await h.req('GET', '/Courses/')).headers.location).toBe('/');
  });

  it('Learn30: pre-Learn30 root pages 301 into the first course (query kept); lessons stay public', async () => {
    const cases: Record<string, string> = {
      '/day/02': '/course/aws-ai-practitioner/day/02',
      '/day/02/': '/course/aws-ai-practitioner/day/02',
      '/outline?x=1': '/course/aws-ai-practitioner/outline?x=1',
      '/mock/1': '/course/aws-ai-practitioner/mock/1',
      '/glossary': '/course/aws-ai-practitioner/glossary',
      '/cheatsheet/services': '/course/aws-ai-practitioner/cheatsheet/services',
      '/cheatsheet/metrics': '/course/aws-ai-practitioner/cheatsheet/metrics',
      '/coverage': '/course/aws-ai-practitioner/coverage',
      '/search?q=bedrock': '/course/aws-ai-practitioner/search?q=bedrock',
    };
    for (const [p, loc] of Object.entries(cases)) {
      const r = await h.req('GET', p);
      expect(r.status, p).toBe(301);
      expect(r.headers.location, p).toBe(loc);
    }
    // Course pages other than the dashboard and mocks are public.
    const { requiresSignIn } = await import('../../server/access');
    for (const r of ['/course/x/day/01', '/course/x/outline', '/course/x/glossary', '/course/x/cheatsheet/services', '/course/x/coverage', '/course/x/search', '/']) expect(requiresSignIn(r), r).toBe(false);
    for (const r of ['/course/x', '/course/x/mock', '/course/x/mock/2', '/settings']) expect(requiresSignIn(r), r).toBe(true);
  });

  it('L5: Windows device names are rejected in any segment', async () => {
    for (const p of ['/con', '/CON', '/nul.txt', '/day/aux', '/prn.html', '/com1', '/LPT9.js', '/scripts/Com3.css']) {
      const r = await h.req('GET', p);
      expect(r.status, p).toBe(404);
    }
    const { safePath } = await import('../../server/static');
    expect(safePath('/console/x')).toBe('/console/x');
    expect(safePath('/com10')).toBe('/com10');
    expect(safePath('/nul.txt')).toBeNull();
  });
});
