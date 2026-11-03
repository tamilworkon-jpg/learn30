import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// E2E_PORT lets parallel worktrees run their own build + server without colliding on 4321.
const port = Number(process.env.E2E_PORT ?? 4321);

// Phase 13 (contracts/server-api.md §8): the suite runs against the Node server with a fresh SQLite file per run
// (the server creates the schema). It lives under site/data/e2e/ (gitignored) rather than test-results/, which
// Playwright empties after the web server has started. The run id is inherited by the worker processes (env), and
// only the main process deletes older databases for this port (their servers are stopped: reuseExistingServer is off).
const run = (process.env.AIP_E2E_RUN ??= String(Date.now()));
const dbDir = resolve('data/e2e');
const db = join(dbDir, `e2e-${port}-${run}.db`);
if (!process.env.TEST_WORKER_INDEX) {
  mkdirSync(dbDir, { recursive: true });
  for (const f of readdirSync(dbDir)) if (f.startsWith(`e2e-${port}-`) && !f.startsWith(`e2e-${port}-${run}.`)) rmSync(join(dbDir, f), { force: true });
  rmSync(db, { force: true });
}

export default defineConfig({
  testDir: 'tests/e2e',
  snapshotPathTemplate: 'tests/e2e/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${port}`,
    screenshot: 'on',
    // No storageState: every test signs up a fresh account (tests/e2e/fixtures.ts), which also saves the Full page
    // lesson view in that account's UiState unless the spec opts out (`test.use({ lessonView: null })`).
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } } },
  ],
  webServer: {
    // Own output folder (dist-e2e) so a test run never fights `npm start` over dist/.
    command: 'npm run build:e2e && npx tsx server/index.ts',
    url: `http://localhost:${port}/login`,
    // Test-only server settings: every test signs up a fresh user from localhost, so lift the sign-up caps and use a
    // cheaper scrypt cost (production defaults: 5 sign-ups/IP/hour, 50 users, N=2^17).
    env: { PORT: String(port), AIP_DIST: 'dist-e2e', AIP_DB: db, AIP_SIGNUPS_PER_HOUR: '100000', AIP_MAX_USERS: '100000', AIP_SCRYPT_N: '16384' },
    // A stale server on the port must never be reused silently (it would hold another database).
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
