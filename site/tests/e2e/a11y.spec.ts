import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { ROUTES, seedTheme } from './routes';

// T174 — axe: zero serious/critical violations on every route, light + dark, desktop + mobile;
// keyboard-only walkthrough of the mock exam (the daily quiz keyboard path is covered in quiz.spec Q-E1).
async function seriousViolations(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  return r.violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
}

test.describe('accessibility (T174)', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const r of ROUTES) {
      test(`axe ${r.name} ${theme}`, async ({ page }) => {
        await seedTheme(page, theme);
        await page.goto(r.path);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await seriousViolations(page)).toEqual([]);
      });
    }
  }

  test('keyboard-only mock exam: start, answer, flag, palette, review, submit', async ({ page }) => {
    await page.goto('/design/fixture-mock');
    const runner = page.locator('[data-mock="mock-1"]');
    const kb = page.keyboard;
    const start = runner.getByRole('button', { name: 'Start mock exam →' });
    await start.focus();
    await kb.press('Enter');
    await expect(page.getByRole('timer')).toBeVisible();

    // answer Q1 with the keyboard (radio group: Space selects, arrows move)
    await runner.locator('input[type="radio"]').first().focus();
    await kb.press('Space');
    await expect(runner.locator('input[type="radio"]:checked')).toHaveCount(1);

    // flag via keyboard
    const flag = runner.locator('.btn-flag');
    await flag.focus();
    await kb.press('Enter');
    await expect(runner.locator('.palette button.flagged')).toHaveCount(1);

    // jump with the palette
    const q5 = runner.locator('.palette button').nth(4);
    await q5.focus();
    await kb.press('Enter');
    await expect(runner.locator('.mock-head .h1')).toContainText('5');

    // open review & submit (on the last question) with the keyboard; focus lands on the review heading
    await runner.locator('.palette button').last().focus();
    await kb.press('Enter');
    await runner.locator('[data-review-submit]').focus();
    await kb.press('Enter');
    await expect(runner.locator('[data-mock-review]').getByRole('heading', { name: 'Review before you submit' })).toBeFocused();
    await runner.getByRole('button', { name: 'Submit exam' }).focus();
    await kb.press('Enter');
    await expect(runner.locator('[data-verdict]')).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);
  });
});
