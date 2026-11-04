import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, test } from './fixtures';
import { attempt, progress, seed } from './progress-fixtures';
import type { Question } from '../../src/lib/types';

// Attempt history: every attempt numbered, with score and a read-only review; retake from the history.
const day2 = (load(readFileSync('src/content/questions/aws-ai-practitioner/day-02.yaml', 'utf8')) as Question[]).sort((a, b) => a.id.localeCompare(b.id));
const mock1 = load(readFileSync('src/content/questions/aws-ai-practitioner/mock-1.yaml', 'utf8')) as Question[];
const shots = process.env.HISTORY_SHOTS;

test.describe('attempt history @visual', () => {
  test('AH1 daily quiz: two attempts listed #1/#2 with scores; Review #1 shows its answers', async ({ page }) => {
    const q = day2.find((x) => x.type === 'single')!;
    const wrong = q.options.find((o) => !(q.answer as string[]).includes(o.id))!;
    const right = q.options.find((o) => (q.answer as string[]).includes(o.id))!;
    await seed(
      page,
      progress({
        attempts: [
          { ...attempt('day-02', { D1: { correct: 6, total: 20 } }, 30), id: 'a1', submittedAt: '2026-10-21T09:20:00.000Z', answers: { [q.id]: [wrong.id] }, score: { correct: 6, total: 20, percent: 30 } },
          { ...attempt('day-02', { D1: { correct: 17, total: 20 } }, 85), id: 'a2', startedAt: '2026-10-22T09:00:00.000Z', submittedAt: '2026-10-22T09:15:00.000Z', answers: { [q.id]: [right.id] }, score: { correct: 17, total: 20, percent: 85 } },
        ],
      }),
    );
    await page.goto('/day/02');
    await page.locator('.quiz-slot').scrollIntoViewIfNeeded();
    const quiz = page.locator('[data-quiz="day-02"]');
    await expect(quiz).toHaveAttribute('data-ready', 'true');
    const hist = page.locator('[data-attempt-history="day-02"]');
    await expect(hist.getByRole('heading', { name: 'Your attempts (2)' })).toBeVisible();
    await expect(hist.locator('[data-attempt-row="1"]')).toContainText('6 / 20 (30%)');
    await expect(hist.locator('[data-attempt-row="2"]')).toContainText('17 / 20 (85%)');
    await expect(hist.locator('[data-attempt-row="2"]')).toContainText('Best');
    await expect(hist.locator('[data-attempt-row="2"]')).toContainText('15 min');
    if (shots) await hist.screenshot({ path: `${shots}/history-list.png` });

    await hist.getByRole('button', { name: 'Review attempt #1' }).click();
    const panel = hist.locator('.ah-review-panel');
    await expect(panel.locator('[data-review-heading]')).toContainText('Attempt #1');
    const item = panel.locator('.review-item').filter({ hasText: q.stem });
    await expect(item).toContainText(`Your answer: ${wrong.text}`);
    await expect(item).toContainText(`Correct answer: ${right.text}`);
    await expect(item).toHaveAttribute('data-correct', 'false');
    if (shots) await hist.screenshot({ path: `${shots}/history-review.png` });
    await hist.getByRole('button', { name: 'Hide review attempt #1' }).click();
    await expect(panel).toBeHidden();
  });

  test('AH2 mock exam: a past attempt shows with scaled score and pass/fail; retake is the runner Start-a-new-attempt button (no duplicate in the history)', async ({ page }) => {
    const q = mock1[0];
    await seed(
      page,
      progress({
        attempts: [{ ...attempt('mock-1', { D1: { correct: 50, total: 65 } }, 77), id: 'm1', kind: 'mock', answers: { [q.id]: q.answer }, score: { correct: 50, total: 65, percent: 76.9, scaled: 792 } }],
      }),
    );
    await page.goto('/mock/1');
    const hist = page.locator('[data-attempt-history="mock-1"]');
    await expect(hist.getByRole('heading', { name: 'Your attempts (1)' })).toBeVisible();
    await expect(hist.locator('[data-attempt-row="1"]')).toContainText('792 / 1000');
    await expect(hist.locator('[data-attempt-row="1"]')).toContainText('Pass');
    await expect(hist.getByRole('link', { name: /Retake exam/ })).toHaveCount(0);
    await hist.getByRole('button', { name: 'Review attempt #1' }).click();
    await expect(hist.locator('.review-item').first()).toContainText('Your answer:');
    if (shots) await page.screenshot({ path: `${shots}/history-mock.png`, fullPage: false });
  });
});
