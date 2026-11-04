/** Page access rules (contract §6; Learn30 spec 002 contracts/routes.md). Everything not listed as protected is public. */
import { legacyCoursePath } from '../src/lib/routes';

/** Canonical route for access checks: lower-case, no trailing `/index.html` or `/`. */
export function routeOf(path: string): string {
  let r = path.toLowerCase();
  if (r.endsWith('/index.html')) r = r.slice(0, -'index.html'.length);
  if (r.length > 1 && r.endsWith('/')) r = r.replace(/\/+$/, '');
  return r || '/';
}

const COURSE_DASHBOARD = /^\/course\/[a-z0-9-]+$/;
const COURSE_MOCK = /^\/course\/[a-z0-9-]+\/mock(\/.*)?$/;

/**
 * `/` is the public course catalogue. An account is needed for Settings, a course's dashboard
 * (`/course/<id>`) and its mock exams (`/course/<id>/mock/*`); lessons, outline, glossary, cheat
 * sheets, coverage and search stay public.
 */
export function requiresSignIn(route: string): boolean {
  return route === '/settings' || COURSE_DASHBOARD.test(route) || COURSE_MOCK.test(route);
}

/** Old addresses keep working (301): /courses → /, and the first course's pre-Learn30 root pages → /course/<id>/…. */
export function legacyRedirect(route: string): string | null {
  return legacyCoursePath(route);
}

export function isAuthPage(route: string): boolean {
  return route === '/login' || route === '/signup';
}

/** `next` is honoured only for same-site relative paths (and never back to the auth pages). */
export function safeNext(next: string | null | undefined): string {
  if (!next || next.length > 2000) return '/';
  // eslint-disable-next-line no-control-regex
  if (!next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(next)) return '/';
  let parsed: URL;
  try {
    parsed = new URL(next, 'http://same.invalid');
  } catch {
    return '/';
  }
  if (parsed.host !== 'same.invalid') return '/';
  if (isAuthPage(routeOf(parsed.pathname))) return '/';
  const result = parsed.pathname + parsed.search + parsed.hash;
  // Dot segments can normalise into a protocol-relative URL (`/..//evil.com` → `//evil.com`): re-check the result.
  if (result.startsWith('//') || result.includes('\\')) return '/';
  return result;
}
