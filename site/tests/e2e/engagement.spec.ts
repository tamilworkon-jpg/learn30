import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { load } from 'js-yaml';
import { expect, test, type Page } from '@playwright/test';
import type { Course } from '../../src/lib/types';
import { noHorizontalScroll, shot, trackConsole } from './helpers';
import { done, progress, readProgress, seed } from './progress-fixtures';

// T107 — streak, badges, celebration, mobile layout.
const course = load(readFileSync('src/data/course.yaml', 'utf8')) as Course;
const pad = (n: number) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const week1 = () => Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [String(n), done(`2026-10-2${n - 1}T09:00:00.000Z`)]));
const dash = (page: Page) => page.locator('[data-dashboard]');

async function markDay3(page: Page) {
  await page.goto('/day/03');
  const mc = page.locator('[data-mark-complete="3"]');
  await mc.scrollIntoViewIfNeeded();
  await expect(mc).toHaveAttribute('data-ready', 'true');
  await mc.getByRole('button', { name: 'Mark Day 3 complete' }).click();
  return page.locator('[data-celebrate]');
}

test.describe('engagement (T107) @visual', () => {
  test('E5 seeded progress shows streak 7 + Week 1 badge', async ({ page }) => {
    const problems = trackConsole(page);
    await seed(page, progress({ days: week1(), streak: { current: 7, longest: 7, lastStudyDate: today() } }));
    await page.goto('/');
    await expect(dash(page)).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-streak]')).toContainText('7-day streak');
    const badges = page.locator('[data-badges]');
    await expect(badges.locator('[data-badge="week-1"]')).toHaveAttribute('data-earned', 'true');
    await expect(badges.locator('[data-badge="streak-7"]')).toHaveAttribute('data-earned', 'true');
    await expect(badges.locator('[data-badge="week-2"]')).toHaveAttribute('data-earned', 'false');
    await expect(badges).toContainText('2 of 7 earned');
    // Derived badges are persisted.
    await expect.poll(async () => (await readProgress(page))?.badges).toEqual(['week-1', 'streak-7']);
    await noHorizontalScroll(page);
    await shot(page, 'dashboard-badges');
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('E5 dark theme badges', async ({ page }) => {
    await seed(page, progress({ settings: { theme: 'dark' }, days: week1(), streak: { current: 7, longest: 7, lastStudyDate: today() } }));
    await page.goto('/');
    await expect(dash(page)).toHaveAttribute('data-ready', 'true');
    await shot(page, 'dashboard-badges-dark');
  });

  test('a lapsed streak shows 0 but keeps the longest', async ({ page }) => {
    await seed(page, progress({ days: { '1': done() }, streak: { current: 4, longest: 4, lastStudyDate: '2026-01-01' } }));
    await page.goto('/');
    await expect(dash(page)).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-streak]')).toContainText('No streak yet today');
    await expect(page.locator('[data-streak]')).toContainText('Longest: 4 days');
  });

  test('E7 celebration with motion: confetti + new badge + streak', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await seed(page, progress({ days: { '1': done(), '2': done(), '4': done(), '5': done(), '6': done(), '7': done() } }));
    const cel = await markDay3(page);
    await expect(cel).toBeVisible();
    await expect(cel).toHaveAttribute('data-motion', 'full');
    await expect(cel).toContainText('Day 3 complete');
    await expect(cel).toContainText('Week 1');
    await expect(cel.locator('.confetti i').first()).toBeAttached();
    expect(await cel.locator('.confetti i').first().evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');
    await page.waitForTimeout(400);
    // Viewport capture: the toast is fixed-position, so a full-page shot of a long lesson hides it.
    await page.screenshot({ path: `tests/e2e/__screenshots__/review/celebrate-${test.info().project.name}.png` });
    await cel.getByRole('button', { name: 'Close' }).click();
    await expect(cel).toHaveCount(0);
    expect((await readProgress(page))?.badges).toContain('week-1');
  });

  test('E7 celebration respects prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const cel = await markDay3(page);
    await expect(cel).toBeVisible();
    await expect(cel).toHaveAttribute('data-motion', 'reduced');
    await expect(cel.locator('.confetti')).toHaveCount(0);
    expect(await cel.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
    await expect(cel).toContainText('Day 3 complete');
  });

  test('E6 every route at 375px has no horizontal scroll', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'mobile-only check');
    test.setTimeout(180_000);
    await seed(page, progress({ days: week1(), streak: { current: 7, longest: 7, lastStudyDate: today() } }));
    const routes = ['/', '/outline', '/settings', ...course.days.map((d) => `/day/${pad(d.day)}`)];
    for (const r of routes) {
      await page.goto(r);
      await page.waitForLoadState('load');
      const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      expect(sw, `${r} scrollWidth ${sw} > clientWidth ${cw}`).toBeLessThanOrEqual(cw);
    }
  });
});
