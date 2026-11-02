import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { TLSSocket } from 'node:tls';
import type { DatabaseSync } from 'node:sqlite';

// ---------- Passwords (scrypt, contract §3) ----------
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scryptAsync(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, N, R, P, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  const salt = Buffer.from(parts[4], 'base64');
  const expected = Buffer.from(parts[5], 'base64');
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0) || expected.length === 0) return false;
  const key = await scryptAsync(password, salt, n, r, p, expected.length);
  return timingSafeEqual(key, expected);
}

/** Hash compared against when the username does not exist, so both failure paths cost one scrypt. */
let dummyHash: Promise<string> | null = null;
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

// ---------- Field rules ----------
export const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;

export function checkUsername(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const u = v.trim().toLowerCase();
  return USERNAME_RE.test(u) ? u : null;
}

export function checkDisplayName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.trim();
  const len = [...d].length;
  if (len < 1 || len > 30 || CONTROL_RE.test(d)) return null;
  return d;
}

export function checkPassword(v: unknown): v is string {
  return typeof v === 'string' && v.length >= 8 && v.length <= 128;
}

// ---------- Sessions + cookies ----------
export const COOKIE_NAME = 'aip_session';
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_REFRESH_MS = 60 * 60 * 1000;

export function newToken(): string {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isHttps(req: IncomingMessage): boolean {
  if ((req.socket as TLSSocket).encrypted) return true;
  const xf = req.headers['x-forwarded-proto'];
  const first = (Array.isArray(xf) ? xf[0] : (xf ?? '')).split(',')[0].trim().toLowerCase();
  return first === 'https';
}

export function sessionCookie(token: string, secure: boolean): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secure ? '; Secure' : ''}`;
}

export function clearCookie(secure: boolean): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? '; Secure' : ''}`;
}

export function readCookie(req: IncomingMessage, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim() || null;
  }
  return null;
}

export interface UserRow {
  id: number;
  username: string;
  display_name: string;
  pass_hash: string;
  created_at: string;
}

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

export function publicUser(u: UserRow): PublicUser {
  return { id: u.id, username: u.username, displayName: u.display_name, createdAt: u.created_at };
}

export interface Session {
  user: UserRow;
  tokenHash: string;
  /** Set-Cookie value to send when the sliding expiry was refreshed on this request. */
  refreshCookie: string | null;
}

export function createSession(db: DatabaseSync, userId: number, now: number): string {
  const token = newToken();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    tokenHash(token),
    userId,
    new Date(now).toISOString(),
    new Date(now + SESSION_TTL_MS).toISOString(),
  );
  return token;
}

/** Look up the request's session; deletes it if expired; slides the expiry at most once per hour. */
export function getSession(db: DatabaseSync, req: IncomingMessage, now: number): Session | null {
  const token = readCookie(req, COOKIE_NAME);
  if (!token || token.length > 100) return null;
  const th = tokenHash(token);
  const row = db
    .prepare(
      `SELECT s.expires_at AS expires_at, u.id AS id, u.username AS username, u.display_name AS display_name,
              u.pass_hash AS pass_hash, u.created_at AS created_at
         FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    )
    .get(th) as (UserRow & { expires_at: string }) | undefined;
  if (!row) return null;
  const expires = Date.parse(row.expires_at);
  if (!(expires > now)) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(th);
    return null;
  }
  let refreshCookie: string | null = null;
  if (now + SESSION_TTL_MS - expires >= SESSION_REFRESH_MS) {
    db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run(new Date(now + SESSION_TTL_MS).toISOString(), th);
    refreshCookie = sessionCookie(token, isHttps(req));
  }
  const { expires_at: _e, ...user } = row;
  return { user, tokenHash: th, refreshCookie };
}

export function purgeExpiredSessions(db: DatabaseSync, now: number): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(new Date(now).toISOString());
}

// ---------- Rate limiting (in memory, contract §3) ----------
export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILS_PER_USER = 10;
export const MAX_FAILS_PER_IP = 50;

export class RateLimiter {
  private fails = new Map<string, number[]>();

  constructor(private readonly clock: () => number) {}

  private recent(key: string): number[] {
    const cutoff = this.clock() - RATE_WINDOW_MS;
    const list = (this.fails.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) this.fails.set(key, list);
    else this.fails.delete(key);
    return list;
  }

  /** Seconds until another attempt is allowed, or 0 when not limited. */
  retryAfter(ip: string, username: string): number {
    const now = this.clock();
    let wait = 0;
    for (const [key, max] of [
      [`u:${ip}:${username}`, MAX_FAILS_PER_USER],
      [`ip:${ip}`, MAX_FAILS_PER_IP],
    ] as const) {
      const list = this.recent(key);
      if (list.length >= max) wait = Math.max(wait, list[list.length - max] + RATE_WINDOW_MS - now);
    }
    return wait > 0 ? Math.ceil(wait / 1000) : 0;
  }

  fail(ip: string, username: string): void {
    const now = this.clock();
    for (const key of [`u:${ip}:${username}`, `ip:${ip}`]) {
      const list = this.recent(key);
      list.push(now);
      this.fails.set(key, list);
    }
  }

  succeed(ip: string, username: string): void {
    this.fails.delete(`u:${ip}:${username}`);
  }
}
