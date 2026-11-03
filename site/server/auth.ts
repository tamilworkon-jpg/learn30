import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { TLSSocket } from 'node:tls';
import type { DatabaseSync } from 'node:sqlite';

// ---------- Passwords (scrypt, contract §3) ----------
/** Cost for new hashes. Older hashes (e.g. N=2^14) still verify and are upgraded on the next successful login. */
export const SCRYPT_N = 2 ** 17;
const R = 8;
const P = 1;
const KEYLEN = 64;
// 128 * N * r bytes are needed (128 MiB at N=2^17, r=8); allow headroom up to the largest accepted N.
const MAXMEM = 288 * 1024 * 1024;

function scryptAsync(password: string, salt: Buffer, n: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, { N: n, r, p, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string, n: number = SCRYPT_N): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, n, R, P, KEYLEN);
  return `scrypt$${n}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
}

interface ParsedHash {
  n: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

/** Parse a stored hash, bounding the parameters so a tampered row cannot request absurd work. */
export function parseHash(stored: string): ParsedHash | null {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [n, r, p] = parts.slice(1, 4).map((x) => (/^\d{1,8}$/.test(x) ? Number(x) : NaN));
  const salt = Buffer.from(parts[4], 'base64');
  const key = Buffer.from(parts[5], 'base64');
  const powerOfTwo = Number.isInteger(n) && n >= 2 ** 10 && n <= 2 ** 18 && (n & (n - 1)) === 0;
  if (!powerOfTwo || !(r >= 1 && r <= 8) || !(p >= 1 && p <= 4)) return null;
  if (salt.length < 8 || salt.length > 64 || key.length < 16 || key.length > 128) return null;
  return { n, r, p, salt, key };
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const h = parseHash(stored);
  if (!h) return false;
  const key = await scryptAsync(password, h.salt, h.n, h.r, h.p, h.key.length);
  return timingSafeEqual(key, h.key);
}

/** True when a hash was made with weaker parameters than `n` (rehash after a successful login). */
export function needsRehash(stored: string, n: number = SCRYPT_N): boolean {
  const h = parseHash(stored);
  return !h || h.n < n || h.r !== R || h.p !== P || h.key.length !== KEYLEN;
}

/** Hash compared against when the username does not exist, so both failure paths cost one scrypt. */
const dummyHashes = new Map<number, Promise<string>>();
export function getDummyHash(n: number = SCRYPT_N): Promise<string> {
  let h = dummyHashes.get(n);
  if (!h) {
    h = hashPassword(randomBytes(16).toString('hex'), n);
    dummyHashes.set(n, h);
  }
  return h;
}

/** Passwords longer than this are never hashed (login, re-verification): they cannot be valid. */
export const MAX_PASSWORD_INPUT = 1024;

// ---------- Field rules ----------
export const USERNAME_RE = /^[a-z0-9_.-]{3,30}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
/** Invisible format characters (zero-width, bidi overrides) would let a name spoof another. */
const FORMAT_RE = /\p{Cf}/u;

export function checkUsername(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const u = v.trim().toLowerCase();
  return USERNAME_RE.test(u) ? u : null;
}

export function checkDisplayName(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.trim();
  const len = [...d].length;
  if (len < 1 || len > 30 || CONTROL_RE.test(d) || FORMAT_RE.test(d)) return null;
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

// ---------- Client identity (contract §3) ----------
export interface Client {
  ip: string;
  /** The TCP peer is this machine (localhost, or a tunnel / port forwarder running locally). */
  loopback: boolean;
}

export function isLoopback(addr: string): boolean {
  return addr === '::1' || /^(::ffff:)?127\./.test(addr);
}

/**
 * The rate-limit identity of a request. With `trustProxy`, a loopback peer (a local tunnel / reverse proxy)
 * that sends X-Forwarded-For is keyed on the address the proxy appended (the right-most entry: earlier
 * entries are supplied by the client and could be forged to dodge the per-IP cap).
 */
export function clientOf(req: IncomingMessage, trustProxy: boolean): Client {
  const peer = req.socket.remoteAddress ?? '';
  const loopback = isLoopback(peer);
  if (loopback && trustProxy) {
    const xff = req.headers['x-forwarded-for'];
    const list = (Array.isArray(xff) ? xff.join(',') : (xff ?? ''))
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const last = list[list.length - 1];
    if (last && last.length <= 64) return { ip: last, loopback: false };
  }
  return { ip: peer, loopback };
}

// ---------- Rate limiting (in memory, contract §3) ----------
export interface Limits {
  /** Failed login / sign-up attempts per (IP, username) per window (per username for loopback peers). */
  failsPerUser: number;
  /** Failed attempts per IP per window. */
  failsPerIp: number;
  /** Failed attempts per IP per window when the peer is loopback (everyone behind a local tunnel shares it). */
  failsPerLoopback: number;
  /** Successful sign-ups per IP per hour (×4 for loopback peers). */
  signupsPerHour: number;
  /** Failed current-password re-verifications (PATCH/DELETE /api/me) per user per window. */
  reverifyFails: number;
}

export const DEFAULT_LIMITS: Limits = { failsPerUser: 10, failsPerIp: 50, failsPerLoopback: 200, signupsPerHour: 5, reverifyFails: 10 };
export const RATE_WINDOW_MS = 15 * 60 * 1000;
export const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
export const LOOPBACK_SIGNUP_FACTOR = 4;

export interface Slot {
  key: string;
  max: number;
}

/** A reserved attempt: recorded before the (slow) password check so parallel guesses all count. */
export interface Reservation {
  release(): void;
}

/** Sliding-window counters. Attempts are reserved up front and released when they turn out fine. */
export class Window {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly clock: () => number,
    private readonly windowMs: number,
  ) {}

  private recent(key: string): number[] {
    const cutoff = this.clock() - this.windowMs;
    const list = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }

  /** Seconds until every slot has room again, or 0 when none is full. */
  retryAfter(slots: Slot[]): number {
    const now = this.clock();
    let wait = 0;
    for (const { key, max } of slots) {
      const list = this.recent(key);
      if (list.length >= max) wait = Math.max(wait, list[list.length - max] + this.windowMs - now);
    }
    return wait > 0 ? Math.max(1, Math.ceil(wait / 1000)) : 0;
  }

  /** Atomically check and record one attempt in every slot; returns the Retry-After seconds when limited. */
  reserve(slots: Slot[]): Reservation | number {
    const wait = this.retryAfter(slots);
    if (wait) return wait;
    const t = this.clock();
    const stamps = slots.map(({ key }) => {
      const list = this.recent(key);
      list.push(t);
      this.hits.set(key, list);
      return key;
    });
    let released = false;
    return {
      release: () => {
        if (released) return;
        released = true;
        for (const key of stamps) {
          const list = this.hits.get(key);
          const i = list ? list.lastIndexOf(t) : -1;
          if (list && i >= 0) list.splice(i, 1);
          if (list && !list.length) this.hits.delete(key);
        }
      },
    };
  }

  clear(key: string): void {
    this.hits.delete(key);
  }

  /** Drop expired entries (called periodically so idle keys don't accumulate). */
  sweep(): void {
    for (const key of [...this.hits.keys()]) this.recent(key);
  }

  get size(): number {
    return this.hits.size;
  }
}

export class RateLimiter {
  readonly fails: Window;
  readonly signups: Window;

  constructor(
    clock: () => number,
    readonly limits: Limits = DEFAULT_LIMITS,
  ) {
    this.fails = new Window(clock, RATE_WINDOW_MS);
    this.signups = new Window(clock, SIGNUP_WINDOW_MS);
  }

  /** Failure slots for a login / sign-up attempt. */
  authSlots(c: Client, username: string): Slot[] {
    return c.loopback
      ? [
          { key: `u:${username}`, max: this.limits.failsPerUser },
          { key: `ip:${c.ip}`, max: this.limits.failsPerLoopback },
        ]
      : [
          { key: `u:${c.ip}:${username}`, max: this.limits.failsPerUser },
          { key: `ip:${c.ip}`, max: this.limits.failsPerIp },
        ];
  }

  signupSlots(c: Client): Slot[] {
    return [{ key: `s:${c.ip}`, max: this.limits.signupsPerHour * (c.loopback ? LOOPBACK_SIGNUP_FACTOR : 1) }];
  }

  reverifySlots(userId: number): Slot[] {
    return [{ key: `me:${userId}`, max: this.limits.reverifyFails }];
  }

  sweep(): void {
    this.fails.sweep();
    this.signups.sweep();
  }
}
