import { expect, test } from './fixtures';
import { noHorizontalScroll, shot, trackConsole } from './helpers';
import { seedTheme } from './routes';

const pages = ['dashboard', 'lesson', 'quiz', 'results', 'mock', 'review'];

test.describe('design mockups (T002) @visual', () => {
  for (const name of pages) {
    for (const theme of ['light', 'dark'] as const) {
      test(`D2–D4 ${name} ${theme}`, async ({ page }) => {
        const problems = trackConsole(page);
        if (theme === 'dark') {
          await seedTheme(page, 'dark');
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
