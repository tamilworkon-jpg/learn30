import { expect, test } from '@playwright/test';
import { noHorizontalScroll, shot, trackConsole } from './helpers';

const pages = ['dashboard', 'lesson', 'quiz', 'results', 'mock', 'review'];

test.describe('design mockups (T002) @visual', () => {
  for (const name of pages) {
    for (const theme of ['light', 'dark'] as const) {
      test(`D2–D4 ${name} ${theme}`, async ({ page }) => {
        const problems = trackConsole(page);
        if (theme === 'dark') {
          await page.addInitScript(() =>
            localStorage.setItem(
              'aip-course:v1',
              JSON.stringify({ schemaVersion: 1, examGuideVersion: '1.2', startedAt: new Date().toISOString(), lastPosition: null, days: {}, attempts: [], inProgress: {}, streak: { current: 0, longest: 0 }, badges: [], settings: { theme: 'dark' }, ratings: {} }),
            ),
          );
        }
        await page.goto(`/design/${name}`);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        await expect(page.locator('h1')).toBeVisible();
        for (const img of await page.locator('figure.diagram img').all()) {
          await img.scrollIntoViewIfNeeded();
          await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { message: 'diagram image loads' }).toBe(true);
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await noHorizontalScroll(page);
        await shot(page, `design-${name}-${theme}`);
        expect(problems, problems.join('\n')).toEqual([]);
      });
    }
  }
});
