import { expect, test } from './fixtures';
import { trackConsole } from './helpers';

// Sanity suite (constitution §Quality Gates, default e2e gate): every page once, one viewport-sized
// screenshot each, desktop only, no console errors. Run with `npm run test:sanity`; the full suite
// (`npm run test:e2e`) runs only when the learner asks for "all".
// Screenshots: tests/e2e/__screenshots__/sanity/<name>.png (git-ignored) — open and inspect them.
const PAGES: [name: string, path: string][] = [
  ['courses', '/courses'],
  ['dashboard', '/'],
  ['outline', '/outline'],
  ['day-01-slides', '/day/01'],
  ['day-02-slides', '/day/02'],
  ['day-07-review', '/day/07'],
  ['day-29-mock-day', '/day/29'],
  ['mock-1', '/mock/1'],
  ['glossary', '/glossary'],
  ['cheatsheet-services', '/cheatsheet/services'],
  ['cheatsheet-metrics', '/cheatsheet/metrics'],
  ['coverage', '/coverage'],
  ['search', '/search?q=bedrock'],
  ['settings', '/settings'],
];

async function capture(page: import('@playwright/test').Page, name: string, path: string) {
  const problems = trackConsole(page);
  const res = await page.goto(path);
  expect(res?.status(), `${path} status`).toBeLessThan(400);
  await expect(page.locator('main, #main').first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `tests/e2e/__screenshots__/sanity/${name}.png` });
  expect(problems, `${path}: ${problems.join('\n')}`).toEqual([]);
}

test.describe('sanity (signed in) @sanity', () => {
  test.use({ lessonView: null }); // the server default (slides), as a learner sees it
  for (const [name, path] of PAGES) test(name, async ({ page }) => capture(page, name, path));
});

test.describe('sanity (signed out) @sanity', () => {
  test.use({ signedIn: false });
  for (const [name, path] of [['login', '/login'], ['signup', '/signup'], ['courses-signed-out', '/courses'], ['day-02-signed-out', '/day/02']] as const)
    test(name, async ({ page }) => capture(page, name, path));
});
