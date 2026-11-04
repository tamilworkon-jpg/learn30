import { COURSE, DEMO, courseHref, expect, test } from './fixtures';
import { trackConsole } from './helpers';

// Sanity suite (constitution §Quality Gates, default e2e gate): every page once, one viewport-sized
// screenshot each, desktop only, no console errors. Run with `npm run test:sanity`; the full suite
// (`npm run test:e2e`) runs only when the learner asks for "all".
// Screenshots: tests/e2e/__screenshots__/sanity/<name>.png (git-ignored) — open and inspect them.
const aws = (page: Parameters<typeof courseHref>[1], arg?: number | string) => courseHref(COURSE, page, arg);
// Global pages + every page of the AWS course at its canonical Learn30 path + the fixture course (spec 002).
const PAGES: [name: string, path: string][] = [
  ['courses', '/'],
  ['dashboard', aws('dashboard')],
  ['outline', aws('outline')],
  ['day-01-slides', aws('day', 1)],
  ['day-02-slides', aws('day', 2)],
  ['day-07-review', aws('day', 7)],
  ['day-29-mock-day', aws('day', 29)],
  ['mock-1', aws('mock', 1)],
  ['glossary', aws('glossary')],
  ['cheatsheet-services', aws('cheatsheet', 'services')],
  ['cheatsheet-metrics', aws('cheatsheet', 'metrics')],
  ['coverage', aws('coverage')],
  ['search', `${aws('search')}?q=bedrock`],
  ['settings', '/settings'],
  ['demo-dashboard', courseHref(DEMO)],
  ['demo-day-01', courseHref(DEMO, 'day', 1)],
  ['demo-mock-1', courseHref(DEMO, 'mock', 1)],
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
  for (const [name, path] of [['login', '/login'], ['signup', '/signup'], ['courses-signed-out', '/'], ['day-02-signed-out', courseHref(COURSE, 'day', 2)], ['demo-day-01-signed-out', courseHref(DEMO, 'day', 1)]] as const)
    test(name, async ({ page }) => capture(page, name, path));
});
