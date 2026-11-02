import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app';

const siteDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT ?? 4321);
const host = process.env.HOST ?? '0.0.0.0';
const dbPath = resolve(process.env.AIP_DB ?? resolve(siteDir, 'data', 'aip.db'));
const distDir = resolve(process.env.AIP_DIST ?? resolve(siteDir, 'dist'));

const app = createApp({ dbPath, distDir });
const server = createServer(app.handler);
server.listen(port, host, () => {
  console.log(`[aip-server] serving ${distDir}`);
  console.log(`[aip-server] database ${dbPath}`);
  console.log(`[aip-server] listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/`);
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
