import { resolve } from 'node:path';
import { expect, test } from './fixtures';
import { pageJsGzipBytes } from '../../scripts/perf-check';

// T176 — P1 lesson page interactive < 2 s with 4× CPU throttling; P2 search results < 1 s (warm, also
// covered by lookup.spec K4); P3 lesson JS < 200 KB gzipped (no runtime Mermaid: diagrams are build-time SVG).
test.describe('performance (T176)', () => {
  test.describe.configure({ mode: 'serial' }); // timings are meaningless under parallel CPU contention

  test('P1 /day/02 interactive < 2 s with 4× CPU throttling', async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto('/day/02', { waitUntil: 'domcontentloaded' });
    // Interactive = DOM interactive + the section nav script has run (current section highlighted).
    await expect(page.locator('.section-nav [aria-current="true"]')).toHaveCount(1);
    const t = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return { interactive: nav.domInteractive, ready: performance.now() };
    });
    test.info().annotations.push({ type: 'timing', description: JSON.stringify(t) });
    expect(t.interactive).toBeLessThan(2000);
    expect(t.ready).toBeLessThan(2000);
  });

  test('P2 search returns results < 1 s (warm)', async ({ page }) => {
    await page.goto('/search');
    const input = page.getByRole('searchbox').or(page.locator('input[type="search"], .pagefind-ui__search-input')).first();
    await input.fill('model');
    await expect(page.locator('.pagefind-ui__result').first()).toBeVisible({ timeout: 10_000 }); // warm-up loads the index
    await input.fill('');
    const start = Date.now();
    await input.fill('guardrails');
    await expect(page.locator('.pagefind-ui__result').first()).toContainText(/guardrail/i);
    expect(Date.now() - start).toBeLessThan(1000);
  });

  test('P3 lesson page ships < 200 KB gzipped JS', () => {
    const { total, files } = pageJsGzipBytes(resolve('dist'), '/day/02');
    test.info().annotations.push({ type: 'js', description: `${(total / 1024).toFixed(1)} KB: ${Object.keys(files).join(', ')}` });
    expect(Object.keys(files).some((f) => /mermaid/i.test(f))).toBe(false);
    expect(total).toBeLessThan(200 * 1024);
  });
});
