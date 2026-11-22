import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';
import { ConfigError, dbFromEnv, optionsFromEnv } from './config';

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 4321);
// Loopback by default: VS Code port forwarding still works; LAN exposure is opt-in with HOST=0.0.0.0.
const host = process.env.HOST ?? '127.0.0.1';
const distDir = resolve(process.env.AIP_DIST ?? resolve(siteDir, 'dist'));

let options: ReturnType<typeof optionsFromEnv>;
let db: ReturnType<typeof dbFromEnv>;
try {
  options = optionsFromEnv(process.env, { signup: 'open' });
  db = dbFromEnv(process.env, resolve(siteDir, 'data', 'aip.db'));
  if (db.path) db = { path: resolve(db.path) };
} catch (e) {
  console.error(`[aip-server] ${e instanceof ConfigError ? e.message : String(e)}`);
  process.exit(1);
}

// Log and keep serving: one bad request must not take the course offline.
process.on('uncaughtException', (e) => console.error('[aip-server] uncaught exception', e));
process.on('unhandledRejection', (e) => console.error('[aip-server] unhandled rejection', e));

const app = createApp({ ...options, db, distDir });
try {
  await app.ready;
} catch (e) {
  console.error('[aip-server] could not open the database', e);
  process.exit(1);
}
const server = createServer((req, res) => void app.handler(req, res));
server.listen(port, host, () => {
  const where = db.url ? db.url.replace(/\?.*$/, '') : db.path;
  console.log(`[aip-server] serving ${distDir}`);
  console.log(
    `[aip-server] database ${where} (max ${options.maxUsers} accounts, sign-up ${options.allowSignup ? 'open' : 'closed (admins create accounts)'}${options.trustProxy ? ', trusting X-Forwarded-For from loopback' : ''})`,
  );
  if (options.admin) console.log(`[aip-server] admin account: ${options.admin.username} → http://localhost:${port}/admin`);
  console.log(`[aip-server] listening on http://${host === '0.0.0.0' || host === '127.0.0.1' ? 'localhost' : host}:${port}/`);
});

function shutdown(): void {
  server.close(() => {
    void app.close().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
