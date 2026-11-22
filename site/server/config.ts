// Server settings from environment variables (local `npm start` and the Vercel function share these rules).
import { DEFAULT_LIMITS, SCRYPT_N } from './auth';
import { DEFAULT_MAX_USERS, type AppOptions } from './app';
import type { DbSpec } from './db';

export class ConfigError extends Error {}

function intEnv(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) throw new ConfigError(`${name} must be a positive integer (got ${JSON.stringify(raw)})`);
  return n;
}

/**
 * Database: AIP_DB_URL (or TURSO_DATABASE_URL, set by the Vercel ↔ Turso integration) selects a hosted libSQL
 * database with AIP_DB_AUTH_TOKEN / TURSO_AUTH_TOKEN; otherwise the local SQLite file AIP_DB (default `fallbackPath`).
 */
export function dbFromEnv(env: NodeJS.ProcessEnv, fallbackPath: string | null): DbSpec {
  const url = env.AIP_DB_URL || env.TURSO_DATABASE_URL;
  if (url) return { url, authToken: env.AIP_DB_AUTH_TOKEN || env.TURSO_AUTH_TOKEN || undefined };
  const path = env.AIP_DB || fallbackPath;
  if (!path) throw new ConfigError('No database configured: set AIP_DB_URL (or TURSO_DATABASE_URL) and its auth token.');
  return { path };
}

/** Everything except the database, dist directory and course ids. */
export function optionsFromEnv(env: NodeJS.ProcessEnv, defaults: { signup: 'open' | 'closed' }): Omit<AppOptions, 'distDir'> {
  const maxUsers = intEnv(env, 'AIP_MAX_USERS', DEFAULT_MAX_USERS);
  const signupsPerHour = intEnv(env, 'AIP_SIGNUPS_PER_HOUR', DEFAULT_LIMITS.signupsPerHour);
  // scrypt cost for new hashes: a power of two in 2^14–2^18 (2^17 ≈ 128 MiB and ~1–2 s per hash on a laptop).
  const scryptN = intEnv(env, 'AIP_SCRYPT_N', SCRYPT_N);
  if (scryptN < 2 ** 14 || scryptN > 2 ** 18 || (scryptN & (scryptN - 1)) !== 0) throw new ConfigError('AIP_SCRYPT_N must be a power of two between 16384 and 262144');
  const signup = (env.AIP_SIGNUP || defaults.signup).toLowerCase();
  if (signup !== 'open' && signup !== 'closed') throw new ConfigError('AIP_SIGNUP must be "open" or "closed"');
  const adminUser = env.AIP_ADMIN_USERNAME?.trim();
  const adminPass = env.AIP_ADMIN_PASSWORD;
  if (!!adminUser !== !!adminPass) throw new ConfigError('Set both AIP_ADMIN_USERNAME and AIP_ADMIN_PASSWORD (or neither)');
  return {
    maxUsers,
    limits: { signupsPerHour },
    trustProxy: env.AIP_TRUST_PROXY === '1',
    scryptN,
    allowSignup: signup === 'open',
    admin: adminUser && adminPass ? { username: adminUser, password: adminPass } : undefined,
  };
}
