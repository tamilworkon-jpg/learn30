// T189 — sign-in helpers: safe `next` redirects, the sign-in link, log out.
import { apiFetch, settleAll } from './api';

/** Only same-site relative paths ("/day/3", not "//evil.example" or "https://…") are honoured. */
export function safeNext(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || raw.length > 2048) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  try {
    const u = new URL(raw, 'http://same.invalid');
    if (u.origin !== 'http://same.invalid') return fallback;
    const out = u.pathname + u.search + u.hash;
    // Dot segments / encoded dots can normalise to a protocol-relative "//host" (off-site): re-check the result.
    // eslint-disable-next-line no-control-regex
    if (!out.startsWith('/') || out.startsWith('//') || out.includes('\\') || /[\u0000-\u001f\u007f]/.test(out)) return fallback;
    // Never bounce back to the auth pages themselves.
    if (/^\/(login|signup)\/?$/.test(u.pathname)) return fallback;
    return out;
  } catch {
    return fallback;
  }
}

export const loginHref = (path: string) => (path && path !== '/' && safeNext(path, '') ? `/login?next=${encodeURIComponent(path)}` : '/login');

/** The `next` query parameter of the current page, validated. */
export const nextFromLocation = (search: string = typeof location === 'undefined' ? '' : location.search) => safeNext(new URLSearchParams(search).get('next'));

/** Save what's pending, end the session, then go to the login page. */
export async function logout(go: (url: string) => void = (u) => location.assign(u)) {
  await settleAll().catch(() => {});
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } catch {
    /* offline: the cookie may survive, but the login page still loads */
  }
  go('/login');
}

export const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;
export function validateUsername(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return 'Enter a username.';
  if (!USERNAME_RE.test(v)) return 'Use 3–30 characters: letters, numbers, dots, dashes or underscores.';
  return null;
}
export function validatePassword(raw: string): string | null {
  if (!raw) return 'Enter a password.';
  if (raw.length < 8) return 'Use at least 8 characters.';
  if (raw.length > 128) return 'Use at most 128 characters.';
  return null;
}
export function validateDisplayName(raw: string): string | null {
  const v = raw.replace(/\s+/g, ' ').trim();
  if (v.length > 30) return 'Use at most 30 characters.';
  return null;
}

export const initials = (name: string) =>
  name
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => [...w][0]!.toUpperCase())
    .join('') || '?';
