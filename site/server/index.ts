import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, DEFAULT_MAX_USERS } from './app';
import { DEFAULT_LIMITS, SCRYPT_N } from './auth';

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 4321);
// Loopback by default: VS Code port forwarding still works; LAN exposure is opt-in with HOST=0.0.0.0.
const host = process.env.HOST ?? '127.0.0.1';
const dbPath = resolve(process.env.AIP_DB ?? resolve(siteDir, 'data', 'aip.db'));
const distDir = resolve(process.env.AIP_DIST ?? resolve(siteDir, 'dist'));

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`[aip-server] ${name} must be a positive integer (got ${JSON.stringify(raw)})`);
    process.exit(1);
  }
  return n;
}

const maxUsers = intEnv('AIP_MAX_USERS', DEFAULT_MAX_USERS);
const signupsPerHour = intEnv('AIP_SIGNUPS_PER_HOUR', DEFAULT_LIMITS.signupsPerHour);
const trustProxy = process.env.AIP_TRUST_PROXY === '1';
// scrypt cost for new hashes: a power of two in 2^14–2^18 (2^17 ≈ 128 MiB and ~1–2 s per hash on a laptop).
const scryptN = intEnv('AIP_SCRYPT_N', SCRYPT_N);
if (scryptN < 2 ** 14 || scryptN > 2 ** 18 || (scryptN & (scryptN - 1)) !== 0) {
  console.error('[aip-server] AIP_SCRYPT_N must be a power of two between 16384 and 262144');
  process.exit(1);
}

// Log and keep serving: one bad request must not take the course offline.
process.on('uncaughtException', (e) => console.error('[aip-server] uncaught exception', e));
process.on('unhandledRejection', (e) => console.error('[aip-server] unhandled rejection', e));

const app = createApp({ dbPath, distDir, maxUsers, limits: { signupsPerHour }, trustProxy, scryptN });
const server = createServer(app.handler);
server.listen(port, host, () => {
  console.log(`[aip-server] serving ${distDir}`);
  console.log(`[aip-server] database ${dbPath} (max ${maxUsers} accounts${trustProxy ? ', trusting X-Forwarded-For from loopback' : ''})`);
  console.log(`[aip-server] listening on http://${host === '0.0.0.0' || host === '127.0.0.1' ? 'localhost' : host}:${port}/`);
});

function shutdown(): void {
  server.close(() => {
    app.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
