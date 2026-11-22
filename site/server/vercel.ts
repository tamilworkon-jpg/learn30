// Vercel serverless entry (bundled by scripts/build-vercel.mjs into .vercel/output/functions/index.func).
// Static assets are served by Vercel's CDN; every page and /api request reaches this function, which adds the
// access rules and the per-page bootstrap exactly like the local server. Data lives in a hosted libSQL / Turso DB.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp, type App } from './app';
import { dbFromEnv, optionsFromEnv } from './config';

declare const __AIP_COURSE_IDS__: string[];

let app: App | null = null;
let failure: unknown = null;

function getApp(): App | null {
  if (app || failure) return app;
  try {
    app = createApp({
      ...optionsFromEnv(process.env, { signup: 'closed' }),
      db: dbFromEnv(process.env, null),
      distDir: join(dirname(fileURLToPath(import.meta.url)), 'dist'),
      courseIds: __AIP_COURSE_IDS__,
      // Vercel overwrites x-real-ip with the caller's address, so it cannot be spoofed for rate limiting.
      ipHeader: 'x-real-ip',
    });
    // A failed start (bad credentials, unreachable DB) is retried on the next request instead of sticking.
    app.ready.catch((e: unknown) => {
      console.error('[aip-server] database start-up failed', e);
      app = null;
    });
  } catch (e) {
    failure = e;
    console.error('[aip-server] configuration error', e);
  }
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const a = getApp();
  if (!a) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end('Server configuration error: check the AIP_* / TURSO_* environment variables in the Vercel project (see the function logs).');
    return;
  }
  await a.handler(req, res);
}
