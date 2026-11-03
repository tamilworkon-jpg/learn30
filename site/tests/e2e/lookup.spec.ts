import { expect, test, type Page } from './fixtures';
import { noHorizontalScroll, shot, trackConsole } from './helpers';

// T096 — US6 lookup: search, glossary, cheat sheets, coverage (K3–K8).

async function dark(page: Page) {
  await page.getByRole('button', { name: /switch to dark theme/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
}

test.describe('lookup (T096) @visual', () => {
  test('K3–K4 search "Guardrails" returns lesson, glossary and service results within 1 s', async ({ page }) => {
    const problems = trackConsole(page);
    await page.goto('/search');
    const input = page.locator('.pagefind-ui__search-input');
    await expect(input).toBeVisible();
    // Warm-up query loads the wasm + index once (cold start is not part of SC-006's "after typing" budget).
    await input.fill('model');
    await expect(page.locator('.pagefind-ui__result').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    const started = Date.now();
    await input.fill('Guardrails');
    const results = page.locator('.pagefind-ui__result');
    await expect(results.first()).toBeVisible({ timeout: 1000 });
    expect(Date.now() - started, 'SC-006 results in < 1 s').toBeLessThan(1000);
    // Results stream in as each page's data loads; wait for each kind rather than snapshotting once.
    for (const kind of ['/day/', '/glossary', '/cheatsheet/services']) {
      await expect(page.locator(`.pagefind-ui__result-link[href*="${kind}"]`).first(), `${kind} result`).toBeVisible();
    }
    await noHorizontalScroll(page);
    await shot(page, 'search');
    await dark(page);
    await shot(page, 'search-dark');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('search reads ?q= and the header search pill leads here', async ({ page }) => {
    await page.goto('/glossary');
    await page.getByTestId('search-pill').click();
    await expect(page).toHaveURL(/\/search$/);
    await page.goto('/search?q=hallucination');
    await expect(page.locator('.pagefind-ui__result').first()).toBeVisible();
  });

  test('K5 glossary A–Z anchors and domain filter', async ({ page }) => {
    test.slow(); // long pages (166 terms / 75 cards) + full-page screenshots: > 30 s on mobile under parallel workers
    const problems = trackConsole(page);
    await page.goto('/glossary');
    const terms = page.getByTestId('glossary-term');
    const total = await terms.count();
    expect(total).toBeGreaterThanOrEqual(140);
    await expect(page.getByRole('link', { name: 'Glossary', exact: true }).first()).toHaveAttribute('aria-current', 'page');

    const az = page.getByRole('navigation', { name: 'Jump to letter' });
    await az.getByRole('link', { name: 'R', exact: true }).click();
    await expect(page).toHaveURL(/#letter-r$/);
    await expect(page.locator('#letter-r')).toBeInViewport();

    // The filter island may hydrate after the page is visible: retry the click until it takes.
    await expect(async () => {
      await page.getByRole('button', { name: 'D4', exact: true }).click();
      await expect(page.getByRole('button', { name: 'D4', exact: true })).toHaveAttribute('aria-pressed', 'true', { timeout: 1000 });
    }).toPass({ timeout: 15000 });
    const visible = page.locator('[data-testid="glossary-term"]:visible');
    const d4 = await visible.count();
    expect(d4).toBeGreaterThan(5);
    expect(d4).toBeLessThan(total);
    for (const chip of await visible.locator('.chip').allTextContents()) expect(chip).toBe('D4');

    await page.getByRole('button', { name: 'All', exact: true }).click();
    await page.getByLabel('Filter terms').fill('retrieval');
    await expect(visible.first()).toContainText(/retrieval/i);
    expect(await visible.count()).toBeLessThan(10);
    await page.getByLabel('Filter terms').fill('zzzzqqq');
    await expect(page.getByText('No terms match')).toBeVisible();

    // A deep link to a term reveals it even when filtered out.
    await page.goto('/glossary?domain=D1#retrieval-augmented-generation');
    await expect(page.locator('#retrieval-augmented-generation')).toBeVisible();
    await noHorizontalScroll(page);
    await page.goto('/glossary');
    await shot(page, 'glossary');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('K6 services sheet shows purpose / choose-when / not-this / scope badge; AWS WAF out of scope', async ({ page }) => {
    test.slow(); // long pages (166 terms / 75 cards) + full-page screenshots: > 30 s on mobile under parallel workers
    const problems = trackConsole(page);
    await page.goto('/cheatsheet/services');
    const cards = page.getByTestId('service-card');
    expect(await cards.count()).toBeGreaterThanOrEqual(60);
    const bedrock = page.locator('[data-service="Amazon Bedrock"]');
    for (const label of ['Purpose', 'Choose when', 'Not this']) await expect(bedrock).toContainText(label);
    await expect(bedrock.getByTestId('scope-badge')).toContainText('In scope');
    const waf = page.locator('[data-service="AWS WAF"]');
    await expect(waf.getByTestId('scope-badge')).toHaveText('Out of scope');
    await expect(waf).toContainText(/Guardrails/);
    await expect(page.locator('[data-service="Amazon Kendra"]').getByTestId('scope-badge')).toHaveText('Not listed');

    await page.getByRole('button', { name: 'Beyond the exam' }).click();
    await expect(bedrock).toBeHidden();
    await expect(waf).toBeVisible();
    await page.getByRole('button', { name: 'All', exact: true }).click();
    await noHorizontalScroll(page);
    await shot(page, 'cheatsheet-services');
    await dark(page);
    await shot(page, 'cheatsheet-services-dark');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('K7 metrics sheet lists the exam metrics with a confusion matrix', async ({ page }) => {
    const problems = trackConsole(page);
    await page.goto('/cheatsheet/metrics');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/metrics/i);
    await expect(page.getByTestId('confusion-matrix')).toBeVisible();
    for (const m of ['Accuracy', 'Precision', 'Recall', 'F1 score', 'AUC-ROC', 'RMSE', 'MAE', 'ROUGE', 'BLEU', 'BERTScore', 'Perplexity', 'LLM-as-a-judge', 'ROI']) {
      await expect(page.getByRole('heading', { level: 3, name: new RegExp(`^${m}`) }).first()).toBeVisible();
    }
    await expect(page.getByRole('navigation', { name: 'Cheat sheets' }).getByRole('link', { name: 'Evaluation metrics' })).toHaveAttribute('aria-current', 'page');
    await noHorizontalScroll(page);
    await shot(page, 'cheatsheet-metrics');
    await dark(page);
    await shot(page, 'cheatsheet-metrics-dark');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('K8 coverage lists all 14 task statements with days and question counts', async ({ page }) => {
    const problems = trackConsole(page);
    await page.goto('/coverage');
    const rows = page.locator('[data-testid="coverage-table"] tbody tr');
    await expect(rows).toHaveCount(14);
    await expect(page.locator('tr[data-ts="1.1"]')).toContainText('Day 1');
    await expect(page.locator('tr[data-ts="1.1"] .day-link.written').first()).toHaveAttribute('href', '/day/01');
    await expect(page.locator('tr[data-ts="5.2"]')).toContainText('Day 27');
    await expect(page.locator('tr[data-ts="5.2"]')).toContainText(/Needs questions|Covered/);
    await expect(page.getByTestId('coverage-summary')).toContainText('14 task statements');
    await noHorizontalScroll(page);
    await shot(page, 'coverage');
    await dark(page);
    await shot(page, 'coverage-dark');
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
