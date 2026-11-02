import { expect, test } from '@playwright/test';
import { ROUTES, themeInit } from './routes';

// T175 — visual regression: every route × desktop/mobile (projects) × light/dark, first viewport, against
// approved baselines in tests/e2e/__screenshots__/visual.spec.ts/. Update with `--update-snapshots` only after
// inspecting the new PNGs.
test.describe('visual regression (T175) @visual', () => {
  for (const theme of ['light', 'dark'] as const) {
    for (const r of ROUTES) {
      test(`${r.name} ${theme}`, async ({ page }) => {
        await page.addInitScript(themeInit(theme));
        await page.goto(r.path);
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => document.fonts.ready);
        await expect(page).toHaveScreenshot(`${r.name}-${theme}.png`, {
          animations: 'disabled',
          caret: 'hide',
          // Relative dates/timers would make baselines flaky.
          mask: [page.locator('[role="timer"], time')],
        });
      });
    }
  }
});
