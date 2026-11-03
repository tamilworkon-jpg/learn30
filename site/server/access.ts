/** Page access rules (contract §6). Everything not listed as protected is public. */

/** Canonical route for access checks: lower-case, no trailing `/index.html` or `/`. */
export function routeOf(path: string): string {
  let r = path.toLowerCase();
  if (r.endsWith('/index.html')) r = r.slice(0, -'index.html'.length);
  if (r.length > 1 && r.endsWith('/')) r = r.replace(/\/+$/, '');
  return r || '/';
}

export function requiresSignIn(route: string): boolean {
  return route === '/' || route === '/settings' || route === '/mock' || route.startsWith('/mock/');
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
