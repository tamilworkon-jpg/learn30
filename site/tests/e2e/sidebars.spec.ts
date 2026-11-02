import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { trackConsole } from './helpers';
import { themeInit } from './routes';

// T187 — collapsible primary navigation (icon rail) and "Today's sections" aside; persisted per browser.
test.use({ storageState: { cookies: [], origins: [] } }); // default slide view

async function seriousAxe(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
}
const viewShot = (page: Page, name: string) => page.screenshot({ path: `tests/e2e/__screenshots__/review/${name}-${test.info().project.name}.png` });
const deckWidth = (page: Page) => page.locator('article[data-lesson-day]').evaluate((e) => e.getBoundingClientRect().width);
const slideCount = async (page: Page) => Number((await page.locator('.deck-count').textContent())!.match(/of (\d+)/)![1]);

test.describe('collapsible side bars (T187) @visual', () => {
  test('mobile keeps the bottom tab bar and hides the toggles', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'mobile only');
    await page.goto('/day/02');
    await expect(page.getByRole('button', { name: 'Collapse navigation' })).toBeHidden();
    await expect(page.getByRole('button', { name: "Hide today's sections" })).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard' })).toBeVisible();
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`collapse + expand both bars, persisted, keyboard operable, axe clean (${theme})`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop only');
      const problems = trackConsole(page);
      await page.addInitScript(themeInit(theme));
      await page.goto('/day/02');
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
      await page.waitForLoadState('networkidle');
      const rail = page.getByRole('button', { name: 'Collapse navigation' });
      const sections = page.getByRole('button', { name: "Hide today's sections" });
      await expect(rail).toHaveAttribute('aria-expanded', 'true');
      await expect(rail).toHaveAttribute('aria-controls', 'primary-nav');
      await expect(sections).toHaveAttribute('aria-controls', 'lesson-aside-body');
      const w0 = await deckWidth(page);
      const sidebarW0 = await page.locator('.sidebar').evaluate((e) => e.getBoundingClientRect().width);

      // keyboard: focus + Enter, focus ring visible
      await rail.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
      const expandRail = page.getByRole('button', { name: 'Expand navigation' });
      await expect(expandRail).toHaveAttribute('aria-expanded', 'false');
      expect(await expandRail.evaluate((e) => getComputedStyle(e).outlineStyle)).not.toBe('none');
      expect(await page.locator('.sidebar').evaluate((e) => e.getBoundingClientRect().width)).toBeLessThan(sidebarW0 / 2);
      // icon rail: labels stay as accessible names and tooltips
      const dash = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard' });
      await expect(dash).toBeVisible();
      await expect(dash).toHaveAttribute('title', 'Dashboard');

      await sections.focus();
      await page.keyboard.press('Space');
      await expect(page.locator('html')).toHaveAttribute('data-sections', 'collapsed');
      await expect(page.getByRole('button', { name: "Show today's sections" })).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByRole('navigation', { name: "Today's sections" })).toBeHidden();
      // the slide takes the freed width and is re-paged to it
      await expect.poll(() => deckWidth(page)).toBeGreaterThan(w0 + 300);
      await expect.poll(async () => page.locator('article[data-lesson-day]').evaluate((a) => a.scrollHeight <= a.clientHeight)).toBe(true);
      await seriousAxe(page);
      await viewShot(page, theme === 'dark' ? 'sidebars-collapsed-dark' : 'sidebars-collapsed');

      // persisted across reloads and pages (applied before paint)
      expect(await page.evaluate(() => [localStorage.getItem('aip-ui:sidebar'), localStorage.getItem('aip-ui:sections')])).toEqual(['collapsed', 'collapsed']);
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
      await expect(page.locator('html')).toHaveAttribute('data-sections', 'collapsed');
      await page.goto('/glossary');
      await expect(page.locator('html')).toHaveAttribute('data-sidebar', 'collapsed');
      await expect(page.getByRole('button', { name: 'Expand navigation' })).toBeVisible();

      // expand again
      await page.goto('/day/02');
      await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
      const n = await slideCount(page);
      await page.getByRole('button', { name: 'Expand navigation' }).click();
      await page.getByRole('button', { name: "Show today's sections" }).click();
      await expect(page.locator('html')).not.toHaveAttribute('data-sidebar', 'collapsed');
      await expect(page.locator('html')).not.toHaveAttribute('data-sections', 'collapsed');
      await expect(page.getByRole('navigation', { name: "Today's sections" })).toBeVisible();
      await expect.poll(() => slideCount(page)).toBeGreaterThan(n); // narrower slide → more slides
      await expect.poll(async () => page.locator('article[data-lesson-day]').evaluate((a) => a.scrollHeight <= a.clientHeight)).toBe(true);
      await seriousAxe(page);
      expect(await page.evaluate(() => [localStorage.getItem('aip-ui:sidebar'), localStorage.getItem('aip-ui:sections')])).toEqual([null, null]);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
