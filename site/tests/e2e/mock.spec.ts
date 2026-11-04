import { existsSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';
import type { Progress } from '../../src/lib/types';
import { noHorizontalScroll, shot, shotEl, trackConsole } from './helpers';
import { editProgress, readProgress, seed as seedProgress } from './progress-fixtures';

// T086 — mock exams on the test-only fixture route /design/fixture-mock (65 synthetic questions, real 90-minute clock;
// the correct option is always "Correct answer N"). Real /mock/N and /day/29–30 degrade to "coming soon" until content lands.
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
/** Saves progress on the server for this test's user (before the first navigation). */
const seed = (page: Page, p: object) => seedProgress(page, p as Progress);
const stored = async (page: Page) => (await readProgress(page))!;
const qid = (n: number) => `q-mock-1-${String(n).padStart(3, '0')}`;
const inProgress = (deadlineMs: number, answers: Record<string, string[]> = {}, flagged: string[] = []) => ({
  'mock-1': {
    answers,
    flagged,
    startedAt: new Date().toISOString(),
    deadline: new Date(deadlineMs).toISOString(),
  },
});
const runner = (page: Page) => page.locator('[data-mock="mock-1"]');

/** The final hand-in lives on the last question only: jump there with the palette, then Review & submit. */
async function openReview(page: Page) {
  await runner(page).locator('.palette button').last().click();
  await runner(page).locator('[data-review-submit]').click();
}
const heading = (page: Page) => runner(page).locator('.mock-head .h1');

test.describe('mock exam (T086) @visual', () => {
  test('M7 65 Q, 90:00 timer, palette nav, flag/unflag; M8 review lists flagged + unanswered; FAIL result', async ({
    page,
  }) => {
    const problems = trackConsole(page);
    await page.goto('/design/fixture-mock');
    await expect(runner(page)).toHaveAttribute('data-phase', 'intro');
    await runner(page).getByRole('button', { name: 'Start mock exam →' }).click();
    await expect(heading(page)).toHaveText('Question 1 of 65');
    await expect(page.getByRole('timer')).toHaveText(/⏱ (90:00|89:5\d)/);
    await expect(page.getByRole('timer')).toHaveAttribute('data-phase', 'normal');
    const pal = runner(page).locator('.palette button');
    await expect(pal).toHaveCount(65);

    // visible radio + requirement pill; no per-question save/submit; never reveals the key
    await expect(runner(page).locator('.q-req')).toHaveText(/Single answer · choose 1/);
    await expect(runner(page).locator('input.opt-input[type="radio"]').first()).toBeVisible();
    await expect(runner(page).locator('[data-save-answer], [data-submit-answer]')).toHaveCount(0);
    // answer Q1, jump with the palette, flag/unflag
    await runner(page).locator('label.opt').filter({ hasText: 'Correct answer 1' }).click();
    await expect(pal.nth(0)).toHaveClass(/answered/);
    await expect(runner(page).locator('[data-feedback], .opt-correct, .opt-wrong')).toHaveCount(0);
    await runner(page).getByRole('button', { name: 'Next question', exact: true }).click();
    await expect(heading(page)).toHaveText('Question 2 of 65');
    await expect(runner(page).locator('[data-feedback], .opt-correct, .opt-wrong')).toHaveCount(0);
    await pal.nth(9).click();
    await expect(heading(page)).toHaveText('Question 10 of 65');
    await expect(pal.nth(9)).toHaveAttribute('aria-current', 'step');
    const flag = runner(page).locator('.btn-flag');
    await flag.click();
    await expect(flag).toHaveAttribute('aria-pressed', 'true');
    await expect(pal.nth(9)).toHaveClass(/flagged/);
    await expect(pal.nth(9)).toHaveAttribute('aria-label', 'Question 10, not answered, flagged');
    await flag.click();
    await expect(flag).toHaveAttribute('aria-pressed', 'false');
    await expect(pal.nth(9)).not.toHaveClass(/flagged/);
    await flag.click();
    await runner(page).getByRole('button', { name: 'Next question', exact: true }).click();
    await runner(page).getByRole('button', { name: 'Next question', exact: true }).click();
    await expect(heading(page)).toHaveText('Question 12 of 65');
    await runner(page).locator('label.opt').filter({ hasText: 'Distractor B 12' }).click();
    await flag.click();
    expect((await stored(page)).inProgress['mock-1'].flagged).toEqual([qid(10), qid(12)]);
    await noHorizontalScroll(page);
    await shotEl(runner(page), 'mock-question');

    // reload resumes the same question set, answers, flags and clock
    await page.reload();
    await expect(runner(page)).toHaveAttribute('data-phase', 'exam');
    await expect(runner(page).locator('.palette button.flagged')).toHaveCount(2);
    await expect(runner(page).locator('.palette button.answered')).toHaveCount(2);

    // M8 review screen
    await openReview(page);
    const review = runner(page).locator('[data-mock-review]');
    await expect(review.getByRole('heading', { name: 'Review before you submit' })).toBeFocused();
    await expect(review).toContainText('2 of 65 answered · 2 flagged · 63 unanswered');
    await expect(review.locator('[data-review-flagged] button')).toHaveText(['10', '12']);
    await expect(review.locator('[data-review-unanswered] button')).toHaveCount(63);
    await expect(review.locator('[data-review-unanswered] button').first()).toHaveText('2');
    await noHorizontalScroll(page);
    await shotEl(runner(page), 'mock-review');
    await review.locator('[data-review-flagged]').getByRole('button', { name: 'Go to question 10' }).click();
    await expect(heading(page)).toHaveText('Question 10 of 65');
    await openReview(page);
    await runner(page).getByRole('button', { name: 'Submit exam' }).click();

    // 1 correct of 65 (Q12 was answered wrongly) → 100 + 900·1/65 = 114 → FAIL
    await expect(runner(page).locator('[data-results-heading]')).toContainText('114');
    await expect(runner(page).locator('[data-verdict]')).toHaveText('FAIL');
    await expect(runner(page).locator('[data-readiness]')).toHaveAttribute('data-readiness', 'not-ready');
    const a = (await stored(page)).attempts.at(-1);
    expect(a).toMatchObject({
      assessmentId: 'mock-1',
      kind: 'mock',
      autoSubmitted: false,
      flagged: [qid(10), qid(12)],
      score: { correct: 1, total: 65, scaled: 114 },
    });
    expect((await stored(page)).inProgress['mock-1']).toBeUndefined();
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('M9 submit → scaled score, PASS, per-domain breakdown', async ({ page }) => {
    const problems = trackConsole(page);
    // Q5–Q54 answered correctly (50 of 65): D1 Q5–13 (9/13), D2 Q14–29 (16/16), D3 Q30–47 (18/18), D4 Q48–54 (7/9), D5 0/9.
    const answers = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [qid(i + 5), ['a']]));
    await seed(page, progress({ inProgress: inProgress(Date.now() + 60 * 60_000, answers, [qid(60)]) }));
    await page.goto('/design/fixture-mock');
    await expect(runner(page)).toHaveAttribute('data-phase', 'exam');
    await expect(page.getByRole('timer')).toHaveText(/⏱ (60:00|59:5\d)/);
    await openReview(page);
    await expect(runner(page).locator('[data-mock-review]')).toContainText(
      '50 of 65 answered · 1 flagged · 15 unanswered',
    );
    await runner(page).getByRole('button', { name: 'Submit exam' }).click();
    await expect(runner(page).locator('[data-results-heading]')).toContainText('792');
    await expect(runner(page).locator('[data-verdict]')).toHaveText('PASS');
    await expect(runner(page).locator('.scaled-card')).toContainText('50 / 65 correct (77%)');
    const rows = runner(page).locator('.dom-row');
    await expect(rows).toHaveCount(5);
    await expect(rows.locator('.dom-score')).toHaveText([
      '9 / 13 · 69%',
      '16 / 16 · 100%',
      '18 / 18 · 100%',
      '7 / 9 · 78%',
      '0 / 9 · 0%',
    ]);
    await expect(runner(page).locator('[data-domain="D5"] .dom-weak')).toHaveText('Needs review');
    await expect(
      runner(page).locator('[data-domain="D5"]').getByRole('link', { name: 'Revisit Day 3' }),
    ).toBeVisible();
    expect((await stored(page)).attempts.at(-1)).toMatchObject({
      score: { scaled: 792 },
      byDomain: { D5: { correct: 0, total: 9 } },
    });
    await page.evaluate(() => window.scrollTo(0, 0));
    await noHorizontalScroll(page);
    await shotEl(runner(page).locator('.mock-results'), 'mock-results');
    // the answer review opens on demand
    await runner(page).locator('details.mock-answers > summary').click();
    await expect(runner(page).locator('.review-item')).toHaveCount(65);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('M10 deadline now+3 s → auto-submit; expired deadline on reload → auto-submitted; timer colours', async ({
    page,
  }) => {
    const problems = trackConsole(page);
    await seed(page, progress({ inProgress: inProgress(Date.now() + 3_000, { [qid(1)]: ['a'] }) }));
    await page.goto('/design/fixture-mock');
    await expect(page.getByRole('timer')).toHaveAttribute('data-phase', 'danger');
    await expect(page.getByRole('timer')).toHaveClass(/timer-danger/);
    await expect(runner(page)).toHaveAttribute('data-phase', 'results', { timeout: 10_000 });
    await expect(runner(page).locator('[data-auto-submitted]')).toContainText('Time ran out');
    let a = (await stored(page)).attempts.at(-1);
    expect(a).toMatchObject({ autoSubmitted: true, score: { correct: 1, total: 65 } });

    // expired while away: reload with a past deadline → submitted immediately on load
    const ip = inProgress(Date.now() - 1_000, { [qid(2)]: ['a', 'e'], [qid(3)]: ['b'] });
    await editProgress(page, (p) => {
      p.inProgress = ip as Progress['inProgress'];
    });
    await expect(runner(page)).toHaveAttribute('data-phase', 'results');
    await expect(runner(page).locator('[data-auto-submitted]')).toBeVisible();
    const s = await stored(page);
    a = s.attempts.at(-1);
    expect(a).toMatchObject({ autoSubmitted: true, score: { correct: 1, total: 65 } });
    expect(s.attempts).toHaveLength(2);
    expect(s.inProgress['mock-1']).toBeUndefined();
    await shotEl(runner(page).locator('.mock-results'), 'mock-autosubmitted');

    // amber under 10 minutes
    const amber = inProgress(Date.now() + 9 * 60_000);
    await editProgress(page, (p) => {
      p.inProgress = amber as Progress['inProgress'];
    });
    await expect(page.getByRole('timer')).toHaveAttribute('data-phase', 'warn');
    await expect(page.getByRole('timer')).toHaveText(/⏱ 0[89]:\d\d/);
    await shotEl(runner(page).locator('.mock-head'), 'mock-timer-warn');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('real routes: /mock/1 and /day/29 (content or graceful "coming soon"); dark theme exam', async ({ page }) => {
    const hasMock1 = existsSync('src/content/questions/mock-1.yaml');
    const hasDay29 = existsSync('src/content/lessons/day-29.mdx');
    const problems = trackConsole(page);
    await seed(
      page,
      progress({
        settings: { theme: 'dark' },
        inProgress: inProgress(Date.now() + 45 * 60_000, { [qid(1)]: ['a'] }, [qid(3)]),
      }),
    );
    await page.goto('/mock/1');
    if (hasMock1) await expect(page.locator('[data-mock="mock-1"]')).toBeVisible();
    else await expect(page.locator('[data-coming-soon="mock"]')).toContainText('Mock exam 1 is coming soon');
    await page.goto('/mock/3');
    await expect(page.locator('h1')).toHaveText('Mock exam 3 (optional final retake)');
    await page.goto('/day/29');
    if (hasDay29) {
      await expect(page.locator('[data-coming-soon="mock-day"]')).toHaveCount(0);
      await expect(page.locator('#remediation')).toBeVisible();
    } else await expect(page.locator('[data-coming-soon="mock-day"]')).toBeVisible();
    await noHorizontalScroll(page);
    await expect(
      page.locator('[data-mock-launch="1"]').getByRole('link', { name: 'Start mock 1 →' }),
    ).toHaveAttribute('href', '/course/aws-ai-practitioner/mock/1');
    await expect(page.locator('[data-mock-last="1"]')).toHaveText(/In progress/);
    await page.goto('/day/30');
    await expect(page.locator('[data-mock-launch]')).toHaveCount(2);

    await page.goto('/design/fixture-mock');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(runner(page)).toHaveAttribute('data-phase', 'exam');
    await noHorizontalScroll(page);
    await shot(page, 'mock-exam-dark');
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

test.describe('mock days (T093, M11–M12) @visual', () => {
  test('M11 Day 29: launch opens /mock/1; remediation lists weak domains after an attempt', async ({
    page,
  }) => {
    const problems = trackConsole(page);
    await page.goto('/design/fixture-mock-day-29');
    await expect(page.locator('#launch [data-mock-launch="1"] a')).toHaveAttribute('href', '/course/aws-ai-practitioner/mock/1');
    await expect(page.locator('[data-remediation="mock-1"]')).toContainText('Take Mock exam 1 first');
    expect(
      await page
        .locator('[data-section-type]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('data-section-type'))),
    ).toEqual(['launch', 'remediation']);

    const now = new Date().toISOString();
    await editProgress(page, (p) => {
      p.attempts.push({
        id: 'm1',
        assessmentId: 'mock-1',
        kind: 'mock',
        startedAt: now,
        submittedAt: now,
        answers: {},
        flagged: [],
        score: { correct: 40, total: 65, percent: 61.54, scaled: 654 },
        byDomain: {
          D1: { correct: 12, total: 13 },
          D2: { correct: 12, total: 16 },
          D3: { correct: 8, total: 18 },
          D4: { correct: 5, total: 9 },
          D5: { correct: 3, total: 9 },
        },
        autoSubmitted: false,
      });
    });
    const rem = page.locator('[data-remediation="mock-1"]');
    await rem.scrollIntoViewIfNeeded();
    await expect(rem).toContainText('654');
    // weak (< 70%) weakest first: D5 33%, D3 44%, D4 56%
    await expect(rem.locator('.dom-row')).toHaveCount(3);
    expect(
      await rem.locator('.dom-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-domain'))),
    ).toEqual(['D5', 'D3', 'D4']);
    await expect(rem.locator('[data-domain="D3"] .dom-revisit a').first()).toHaveText(/Revisit Day \d+/);
    await expect(page.locator('[data-mock-last="1"]')).toHaveText('Last attempt: 654 / 1000 · FAIL (62%)');
    await noHorizontalScroll(page);
    await shot(page, 'mock-day-29');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('M12 Day 30: launches for Mock 2 and 3; strategy covers registration, delivery, 90 min / 65 Q, question types', async ({
    page,
  }) => {
    const problems = trackConsole(page);
    await page.goto('/design/fixture-mock-day-30');
    await expect(page.locator('[data-mock-launch="2"] a')).toHaveAttribute('href', '/course/aws-ai-practitioner/mock/2');
    await expect(page.locator('[data-mock-launch="3"] a')).toHaveAttribute('href', '/course/aws-ai-practitioner/mock/3');
    await expect(page.locator('[data-mock-launch="3"]')).toContainText('Optional final retake');
    const strategy = page.locator('#exam-strategy');
    for (const t of [
      'Registration',
      'Pearson VUE',
      '65 questions in 90 minutes',
      'multiple response',
      'ordering',
      'matching',
    ])
      await expect(strategy).toContainText(t);
    await noHorizontalScroll(page);
    await shot(page, 'mock-day-30');
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
