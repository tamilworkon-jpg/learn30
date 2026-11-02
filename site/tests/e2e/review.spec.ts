import { existsSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { noHorizontalScroll, shot, shotEl, trackConsole } from './helpers';

// T079 — weekly review days. Real routes for the summary (content is written later); the test-only fixture route
// /design/fixture-review renders the documented example MDX + an 8-question week-1 fixture for W2–W4.
const KEY = 'aip-course:v1';
const progress = (extra: Record<string, unknown> = {}) => ({
  schemaVersion: 1,
  examGuideVersion: '1.2',
  startedAt: new Date().toISOString(),
  lastPosition: null,
  days: {},
  attempts: [],
  inProgress: {},
  streak: { current: 0, longest: 0 },
  badges: [],
  settings: {},
  ratings: {},
  ...extra,
});
const seed = (page: Page, p: object) =>
  page.addInitScript(([k, v]) => localStorage.getItem(k) ?? localStorage.setItem(k, v), [
    KEY,
    JSON.stringify(p),
  ] as const);
const stored = (page: Page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), KEY);

test.describe('weekly review (T079) @visual', () => {
  test('W1 summary lists every prior lesson day grouped by domain; content or graceful "coming soon"', async ({
    page,
  }) => {
    const problems = trackConsole(page);
    await seed(
      page,
      progress({
        days: {
          '1': { status: 'completed', sectionsViewed: [], bestScore: 90 },
          '2': { status: 'completed', sectionsViewed: [], bestScore: 70 },
        },
      }),
    );
    await page.goto('/day/07');
    await expect(page.locator('h1')).toHaveText('Week 1 review');
    const d1 = page.locator('.review-domain[data-domain="D1"]');
    const d4 = page.locator('.review-domain[data-domain="D4"]');
    await expect(page.locator('.review-domain')).toHaveCount(2);
    for (const n of [1, 2, 3, 4, 5, 6])
      await expect(d1.getByRole('link', { name: new RegExp(`^Day ${n}:`) })).toHaveAttribute(
        'href',
        `/day/0${n}`,
      );
    await expect(d4.getByRole('link')).toHaveCount(1);
    await expect(d4.getByRole('link')).toContainText('Day 2:');
    await expect(d1.locator('.review-avg')).toHaveText('Daily quiz average 80% (2 of 6 days taken)');
    // Day 7 MDX and week-1.yaml: real content when authored, otherwise both parts say "coming soon".
    if (existsSync('src/content/lessons/day-07.mdx')) {
      await expect(page.locator('[data-coming-soon="review-content"]')).toHaveCount(0);
      await expect(page.locator('#concept-map figure.diagram img')).toHaveCount(1);
      expect(await page.locator('#top-facts ol > li').count()).toBeGreaterThanOrEqual(20);
    } else await expect(page.locator('[data-coming-soon="review-content"]')).toBeVisible();
    if (existsSync('src/content/questions/week-1.yaml')) await expect(page.locator('#weekly-test [data-quiz="week-1"]')).toBeAttached();
    else await expect(page.locator('#weekly-test')).toContainText('coming soon');
    await noHorizontalScroll(page);
    await shotEl(page.locator('#summary'), 'review-summary');

    await page.goto('/day/14');
    const days = await page
      .locator('.review-domain a')
      .evaluateAll((as) =>
        [...new Set(as.map((a) => Number(a.getAttribute('href')!.slice(5))))].sort((x, y) => x - y),
      );
    expect(days).toEqual([1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13]);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('W2 concept map renders; W3 per-domain bars + Revisit links; W4 rating saves to ratings.week-1', async ({
    page,
  }) => {
    const problems = trackConsole(page);
    await page.goto('/design/fixture-review');
    // W2
    const map = page.locator('#concept-map figure.diagram');
    await expect(map.locator('figcaption')).toContainText('Week 1 concept map');
    await map.locator('img').scrollIntoViewIfNeeded();
    await expect
      .poll(() => map.locator('img').evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
      .toBe(true);
    await expect(page.locator('#top-facts ol > li')).toHaveCount(20);
    expect(
      await page
        .locator('[data-section-type]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-section-type'))),
    ).toEqual(['summary', 'conceptMap', 'topFacts', 'traps', 'quiz', 'results', 'rating']);

    // W3: Q1–Q6 (D1) correct, Q7–Q8 (D4) wrong.
    const quiz = page.locator('[data-quiz="week-1"]');
    await quiz.scrollIntoViewIfNeeded();
    await expect(quiz).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('#domain-results')).toContainText('Submit the cumulative test');
    for (let n = 1; n <= 8; n++) {
      await quiz
        .locator('label.opt')
        .filter({ hasText: n <= 6 ? `Correct answer ${n}` : `Distractor B ${n}` })
        .click();
      await quiz.getByRole('button', { name: n < 8 ? 'Next →' : 'Submit quiz' }).click();
    }
    await expect(quiz.locator('[data-results-heading]')).toContainText('6 / 8');
    const results = page.locator('#domain-results');
    await expect(results.locator('.dom-row')).toHaveCount(2);
    await expect(results.locator('[data-domain="D1"] .dom-score')).toHaveText('6 / 6 · 100%');
    await expect(results.locator('[data-domain="D1"]')).toHaveAttribute('data-weak', 'false');
    await expect(results.locator('[data-domain="D4"] .dom-score')).toHaveText('0 / 2 · 0%');
    await expect(results.locator('[data-domain="D4"] .dom-weak')).toHaveText('Needs review');
    await expect(
      results.locator('[data-domain="D4"]').getByRole('link', { name: 'Revisit Day 2' }),
    ).toHaveAttribute('href', '/day/02');
    await expect(results.locator('progress.dom-bar-D1')).toHaveAttribute('value', '100');
    const attempt = (await stored(page)).attempts.at(-1);
    expect(attempt).toMatchObject({
      assessmentId: 'week-1',
      kind: 'weekly',
      byDomain: { D1: { correct: 6, total: 6 }, D4: { correct: 0, total: 2 } },
    });
    await noHorizontalScroll(page);
    await shotEl(results, 'review-results');

    // W4: rating (keyboard-operable radios)
    const rating = page.locator('.rating');
    await rating.scrollIntoViewIfNeeded();
    await expect(rating).toHaveAttribute('data-ready', 'true');
    await rating.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await rating.locator('label.rating-star').nth(3).click();
    await expect(rating.getByRole('radio', { name: /^4 of 5/ })).toBeChecked();
    await expect(rating.getByRole('status')).toContainText('saved your rating: 4 of 5');
    expect((await stored(page)).ratings).toEqual({ 'week-1': 4 });
    await rating.getByRole('radio', { name: /^4 of 5/ }).press('ArrowRight');
    await expect.poll(async () => (await stored(page)).ratings['week-1']).toBe(5);
    await page.reload();
    await page.locator('.rating').scrollIntoViewIfNeeded();
    await expect(page.locator('.rating')).toHaveAttribute('data-rating', '5');
    await expect(page.locator('.rating').getByRole('radio', { name: /^5 of 5/ })).toBeChecked();
    // Results by domain survive the reload (latest attempt from the store).
    await expect(page.locator('#domain-results .dom-row')).toHaveCount(2);
    await shotEl(page.locator('#rating'), 'review-rating');
    await shot(page, 'review-page');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('dark theme review page', async ({ page }) => {
    const problems = trackConsole(page);
    await seed(
      page,
      progress({
        settings: { theme: 'dark' },
        ratings: { 'week-1': 3 },
        attempts: [
          {
            id: 'w1',
            assessmentId: 'week-1',
            kind: 'weekly',
            startedAt: new Date().toISOString(),
            submittedAt: new Date().toISOString(),
            answers: { 'q-week-1-001': ['a'], 'q-week-1-007': ['a'] },
            flagged: [],
            score: { correct: 2, total: 8, percent: 25 },
            byDomain: { D1: { correct: 1, total: 6 }, D4: { correct: 1, total: 2 } },
            autoSubmitted: false,
          },
        ],
      }),
    );
    await page.goto('/design/fixture-review');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    const results = page.locator('#domain-results');
    await results.scrollIntoViewIfNeeded();
    await expect(results.locator('[data-domain="D1"] .dom-revisit a')).toHaveText([
      'Revisit Day 1',
      'Revisit Day 2',
      'Revisit Day 3',
    ]);
    await page.locator('.rating').scrollIntoViewIfNeeded();
    await expect(page.locator('.rating')).toHaveAttribute('data-rating', '3');
    await noHorizontalScroll(page);
    await shotEl(page.locator('.review'), 'review-dark');
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
