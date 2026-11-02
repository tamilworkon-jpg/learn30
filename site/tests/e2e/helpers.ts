import { expect, test, type Locator, type Page } from '@playwright/test';

export function trackConsole(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  return problems;
}

export async function noHorizontalScroll(page: Page) {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw, 'page must not scroll horizontally').toBeLessThanOrEqual(cw);
}

export async function shot(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `tests/e2e/__screenshots__/review/${name}-${test.info().project.name}.png`, fullPage: true });
}

/** Screenshot of one element (for long pages where a full-page capture is unreadable). */
export async function shotEl(locator: Locator, name: string) {
  await locator.screenshot({ path: `tests/e2e/__screenshots__/review/${name}-${test.info().project.name}.png` });
}
