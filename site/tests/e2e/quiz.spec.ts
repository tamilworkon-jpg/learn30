import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, settleSaves, test, type Page } from './fixtures';
import type { Question } from '../../src/lib/types';
import { noHorizontalScroll, shotEl, trackConsole } from './helpers';
import { progress, readProgress, seed } from './progress-fixtures';

// T050 — daily quiz on Day 2 (has all four question types).
const qs = (load(readFileSync('src/content/questions/day-02.yaml', 'utf8')) as Question[]).sort((a, b) => a.id.localeCompare(b.id));
const idx = (type: Question['type']) => qs.findIndex((q) => q.type === type);
const quiz = (page: Page) => page.locator('[data-quiz="day-02"]');

async function openQuiz(page: Page) {
  await page.goto('/day/02');
  await page.locator('.quiz-slot').scrollIntoViewIfNeeded();
  await expect(quiz(page)).toHaveAttribute('data-ready', 'true');
}

async function goTo(page: Page, i: number) {
  const heading = quiz(page).getByText(/^Question \d+ of \d+$/);
  let moved = false;
  for (;;) {
    const current = Number((await heading.textContent())!.match(/Question (\d+)/)![1]) - 1;
    if (current === i) {
      // The runner moves focus to the new question in a deferred effect; wait for it so it can't steal focus later.
      if (moved) await expect(quiz(page).locator('legend.q-stem')).toBeFocused();
      return;
    }
    moved = true;
    await quiz(page)
      .getByRole('button', { name: current < i ? 'Next question' : 'Previous question', exact: true })
      .click();
  }
}

const submitBtn = (page: Page) => quiz(page).locator('[data-submit-quiz]');
/** Questions that need an answer before "Submit quiz" (an untouched ordering question already counts). */
const needAnswer = qs.filter((q) => q.type !== 'ordering').length;

/** The only submit: "Submit quiz" on the last question, enabled once every question is answered. */
async function submitQuiz(page: Page) {
  await goTo(page, qs.length - 1);
  await expect(submitBtn(page)).toBeEnabled();
  await submitBtn(page).click();
}

/** Answer every question not in `skip` with a WRONG answer (ordering questions are left as shown — also wrong). */
async function answerRestWrong(page: Page, skip: number[]) {
  for (const [i, q] of qs.entries()) {
    if (skip.includes(i) || q.type === 'ordering') continue;
    await goTo(page, i);
    const key = q.type === 'matching' ? [] : (q.answer as string[]);
    if (q.type === 'single') {
      await quiz(page).locator('label.opt').filter({ hasText: q.options.find((o) => !key.includes(o.id))!.text }).click();
    } else if (q.type === 'multi') {
      const pick = [...q.options.filter((o) => !key.includes(o.id)), ...q.options.filter((o) => key.includes(o.id))].slice(0, key.length);
      for (const o of pick) await quiz(page).locator('label.opt').filter({ hasText: o.text }).click();
    } else {
      // matching: every prompt → the same target (at least one is then wrong)
      const target = Object.values(q.answer as Record<string, string>)[0];
      const wrongTarget = Object.values(q.answer as Record<string, string>).find((t) => t !== target) ?? target;
      for (const o of q.options) await quiz(page).locator(`#${q.id}-${o.id}`).selectOption(wrongTarget);
    }
  }
}

/** Reorder with the ↑ buttons until the list equals the key (mouse only). */
async function solveOrdering(page: Page, q: Question) {
  const key = q.answer as string[];
  const current = () => quiz(page).locator('.order-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-item')!));
  for (let target = 0; target < key.length; target++) {
    let pos = (await current()).indexOf(key[target]);
    while (pos > target) {
      await quiz(page).locator(`[data-item="${key[target]}"] [data-dir="up"]`).click();
      pos--;
    }
  }
  expect(await current()).toEqual(key);
}

test.describe('daily quiz (T050) @visual', () => {
  test('Q-E1 mouse: all four types; Q-E2 confirm; Q-E3 results; Q-E4 best after reload; Q-E5 retake', async ({ page }) => {
    const problems = trackConsole(page);
    await openQuiz(page);
    await expect(quiz(page)).toContainText('Question 1 of 20');

    // single (correct): visible radios + requirement pill; no per-question submit
    const s = qs[idx('single')];
    await goTo(page, idx('single'));
    await expect(quiz(page).locator('.q-req')).toHaveText(/Single answer · choose 1/);
    await expect(quiz(page).locator('input.opt-input[type="radio"]')).toHaveCount(s.options.length);
    await expect(quiz(page).locator('input.opt-input[type="radio"]').first()).toBeVisible();
    await expect(quiz(page).locator('[data-submit-answer], [data-feedback]')).toHaveCount(0);
    await quiz(page).locator('label.opt').filter({ hasText: s.options.find((o) => o.id === (s.answer as string[])[0])!.text }).click();
    await expect(quiz(page).locator('label.opt-selected')).toHaveCount(1);
    await expect(quiz(page).locator('[data-feedback], .opt-correct')).toHaveCount(0); // nothing revealed before the end
    await shotEl(quiz(page), 'quiz-single');

    // multi (correct): choose-N limit
    const m = qs[idx('multi')];
    await goTo(page, idx('multi'));
    const need = (m.answer as string[]).length;
    await expect(quiz(page).locator('.q-hint')).toContainText(`Select ${['', 'ONE', 'TWO', 'THREE'][need]}`);
    await expect(quiz(page).locator('.q-req')).toHaveText(new RegExp(`Multiple answers · choose ${need}`));
    await expect(quiz(page).locator('input.opt-input[type="checkbox"]').first()).toBeVisible();
    await shotEl(quiz(page), 'quiz-multi');
    const optLabel = (id: string) => quiz(page).locator('label.opt').filter({ hasText: m.options.find((o) => o.id === id)!.text });
    for (const id of m.answer as string[]) await optLabel(id).click();
    await expect(quiz(page).locator('.q-hint')).toContainText(`${need} selected`);
    // at the limit the other options are disabled until one is unticked
    await expect(quiz(page).locator('[data-limit]')).toContainText(`You've chosen ${need} of ${need}`);
    await expect(quiz(page).locator('input.opt-input[type="checkbox"]:disabled')).toHaveCount(m.options.length - need);
    await shotEl(quiz(page), 'quiz-multi-limit');
    await optLabel((m.answer as string[])[0]).click();
    await expect(quiz(page).locator('input.opt-input[type="checkbox"]:disabled')).toHaveCount(0);
    await optLabel((m.answer as string[])[0]).click();

    // ordering (correct)
    const o = qs[idx('ordering')];
    await goTo(page, idx('ordering'));
    await solveOrdering(page, o);
    await shotEl(quiz(page), 'quiz-ordering');

    // matching (correct)
    const mt = qs[idx('matching')];
    await goTo(page, idx('matching'));
    for (const [opt, target] of Object.entries(mt.answer as Record<string, string>)) {
      await quiz(page).locator(`#${mt.id}-${opt}`).selectOption(target);
    }
    await expect(quiz(page).locator('.q-hint')).toContainText(`${mt.options.length} of ${mt.options.length} matched`);
    await shotEl(quiz(page), 'quiz-matching');

    // Q-E2 "Submit quiz" only on the last question, disabled until every question is answered;
    // "Go to first unanswered" jumps to the first one still missing
    await expect(quiz(page).getByRole('button', { name: 'Submit now' })).toHaveCount(0);
    await expect(submitBtn(page)).toHaveCount(0); // not on this (non-last) question
    const done = [idx('single'), idx('multi'), idx('ordering'), idx('matching')];
    await goTo(page, qs.length - 1);
    await expect(submitBtn(page)).toBeDisabled();
    const missing = needAnswer - 3; // single, multi and matching are answered (ordering always counts)
    await expect(quiz(page).locator('[data-pending]')).toHaveText(`${missing} questions unanswered`);
    await quiz(page).locator('[data-first-unanswered]').click();
    const firstMissing = qs.findIndex((q, i) => !done.includes(i) && q.type !== 'ordering');
    await expect(quiz(page)).toContainText(`Question ${firstMissing + 1} of 20`);
    await answerRestWrong(page, done);
    await submitQuiz(page);

    // Q-N2 "What's next" (below the pass mark): revisit the sections behind the wrong answers, Retake first
    const next = quiz(page).locator('[data-next-steps]');
    await expect(next).toHaveAttribute('data-next-steps', 'retry');
    await expect(next.getByRole('heading')).toHaveText('Score 20% — aim for 80%');
    const revisit = next.locator('[data-revisit] a');
    expect(await revisit.count()).toBeGreaterThan(0);
    for (const href of await revisit.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) expect(href).toMatch(/^\/day\/\d{2}#[a-z0-9-]+$/);
    await expect(revisit.first()).toHaveText(/^Day \d+ · .+/);
    await expect(next.locator('[data-next-primary]')).toHaveText(/Retake quiz/);
    await expect(next.locator('[data-next-anyway]')).toHaveText('Mark complete & continue to Day 3 anyway');
    await expect(next).toBeInViewport();

    // Q-E3 results
    const results = quiz(page).locator('.quiz-results');
    await expect(results.getByRole('img', { name: 'Score 20 percent' })).toBeVisible();
    await expect(results).toContainText('4 / 20');
    await expect(results.locator('.review-item')).toHaveCount(20);
    await expect(results.locator('.review-item[data-correct="true"]')).toHaveCount(4);
    const wrong = results.locator('.review-item[data-correct="false"]').first();
    await expect(wrong).toContainText('Your answer:');
    await expect(wrong).toContainText('Correct answer:');
    await wrong.locator('details.opt-explain summary').click();
    const wq = qs.find((q) => !done.map((i) => qs[i].id).includes(q.id))!;
    for (const op of wq.options) await expect(wrong).toContainText(op.explanation);
    await expect(wrong.getByRole('link', { name: 'Review in lesson →' })).toHaveAttribute('href', `/day/02#${wq.lessonRef.split('#')[1]}`);
    await noHorizontalScroll(page);
    await shotEl(results, 'quiz-results');

    // Q-E5 retake from results starts empty at question 1
    await quiz(page).getByRole('button', { name: /Retake quiz/ }).click();
    await expect(quiz(page)).toContainText('Question 1 of 20');
    await expect(quiz(page)).toContainText('0 / 20 answered');

    // Q-E4 best score survives reload; in-progress answers were cleared by submit
    await page.reload();
    await page.locator('.quiz-slot').scrollIntoViewIfNeeded();
    await expect(quiz(page)).toHaveAttribute('data-ready', 'true');
    await expect(quiz(page)).toContainText('Best score: 20%');
    await expect(quiz(page)).toContainText('0 / 20 answered');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('Q-E1 keyboard only: single, multi, ordering, matching; answers persist across reload', async ({ page }) => {
    await openQuiz(page);
    const kb = page.keyboard;

    // single: arrow keys within the radio group
    await goTo(page, idx('single'));
    await quiz(page).locator('input[type="radio"]').first().focus();
    await kb.press('Space');
    await kb.press('ArrowDown');
    await expect(quiz(page).locator('input[type="radio"]:checked')).toHaveValue(qs[idx('single')].options[1].id);
    // The › edge arrow is a button: activate with Enter → focus lands on the new question
    await quiz(page).getByRole('button', { name: 'Next question', exact: true }).focus();
    await kb.press('Enter');
    await expect(quiz(page).locator('legend.q-stem')).toBeFocused();

    // multi: Space toggles checkboxes
    await goTo(page, idx('multi'));
    await quiz(page).locator('input[type="checkbox"]').nth(0).focus();
    await kb.press('Space');
    await kb.press('Tab');
    await kb.press('Space');
    await expect(quiz(page).locator('input[type="checkbox"]:checked')).toHaveCount(2);

    // ordering: Enter on a ↓ button moves the item and keeps focus on it
    await goTo(page, idx('ordering'));
    const first = await quiz(page).locator('.order-item').first().getAttribute('data-item');
    await quiz(page).locator(`[data-item="${first}"] [data-dir="down"]`).focus();
    await kb.press('Enter');
    await expect(quiz(page).locator('.order-item').nth(1)).toHaveAttribute('data-item', first!);
    await expect(quiz(page).locator(`[data-item="${first}"] [data-dir="down"]`)).toBeFocused();
    await kb.press('Enter');
    await expect(quiz(page).locator('.order-item').nth(2)).toHaveAttribute('data-item', first!);
    await expect(quiz(page).locator('.q-fieldset [aria-live="polite"]')).toContainText('moved to position 3');

    // matching: arrow keys change a focused select
    await goTo(page, idx('matching'));
    const sel = quiz(page).locator('select.match-select').first();
    await sel.focus();
    await kb.press('ArrowDown');
    await expect(sel).not.toHaveValue('');

    // Q-S1 end-to-end: answers survive a reload
    await page.reload();
    await page.locator('.quiz-slot').scrollIntoViewIfNeeded();
    await expect(quiz(page)).toHaveAttribute('data-ready', 'true');
    // single + multi + ordering count as answered; matching is only partly matched (1 prompt) so it doesn't count yet…
    await expect(quiz(page)).toContainText('3 / 20 answered');
    // …but the partial match is still saved and restored.
    await goTo(page, idx('matching'));
    await expect(quiz(page).locator('select.match-select').first()).not.toHaveValue('');
    await expect(quiz(page).locator('.q-hint')).toContainText(`1 of ${qs[idx('matching')].options.length} matched`);
  });

  test('Q-P1 a reload keeps answers and the current question; arrows; no per-question submit; Submit quiz on the last question only', async ({ page }) => {
    await openQuiz(page);
    // ‹ › arrows on the card: Previous disabled on question 1; no submit of any kind there
    await expect(quiz(page).getByRole('button', { name: 'Previous question', exact: true })).toBeDisabled();
    await expect(quiz(page).getByRole('button', { name: 'Submit now' })).toHaveCount(0);
    await expect(quiz(page).locator('[data-submit-quiz], [data-submit-answer]')).toHaveCount(0);
    await expect(quiz(page).locator('.quiz-nav')).toHaveCount(0);

    // answer the single question, partly answer the multi question
    const s1 = qs[idx('single')];
    await goTo(page, idx('single'));
    await quiz(page).locator('label.opt').filter({ hasText: s1.options.find((o) => o.id === (s1.answer as string[])[0])!.text }).click();
    const m = qs[idx('multi')];
    await goTo(page, idx('multi'));
    await quiz(page).locator('label.opt').filter({ hasText: m.options[0].text }).click();
    await settleSaves(page);

    await page.reload();
    await page.locator('.quiz-slot').scrollIntoViewIfNeeded();
    await expect(quiz(page)).toHaveAttribute('data-ready', 'true');
    // reopens on the same question with its partial answer; the single answer is kept and still editable
    await expect(quiz(page)).toContainText(`Question ${idx('multi') + 1} of 20`);
    await expect(quiz(page).locator('input[type="checkbox"]:checked')).toHaveCount(1);
    await expect(quiz(page)).toContainText('2 / 20 answered');
    await goTo(page, idx('single'));
    await expect(quiz(page).locator('input[type="radio"]:checked')).toHaveCount(1);
    await expect(quiz(page).locator('input[type="radio"]').first()).toBeEnabled();

    // the last question offers the final submit (disabled: questions still unanswered); Next is disabled there
    await goTo(page, qs.length - 1);
    await expect(quiz(page).getByRole('button', { name: 'Next question', exact: true })).toBeDisabled();
    await expect(submitBtn(page)).toBeVisible();
    await expect(submitBtn(page)).toBeDisabled();
    await shotEl(quiz(page), 'quiz-last-question');
  });

  test('Q-N1 passing quiz: "What\'s next" marks the day complete and opens the next day', async ({ page }) => {
    // Every question answered correctly and saved, reopened on the last question (no per-question clicks).
    const answers = Object.fromEntries(qs.map((q) => [q.id, q.answer]));
    await seed(page, progress({ inProgress: { 'day-02': { answers, flagged: [], startedAt: '2026-10-21T09:00:00.000Z', index: qs.length - 1 } } }));
    await openQuiz(page);
    await expect(quiz(page)).toContainText(`Question ${qs.length} of ${qs.length}`);
    await submitQuiz(page);
    const next = quiz(page).locator('[data-next-steps]');
    await expect(next).toHaveAttribute('data-next-steps', 'pass');
    await expect(next.getByRole('heading')).toHaveText('Nice work — Day 2 quiz passed');
    await expect(next).toBeInViewport();
    await expect(next.getByRole('button', { name: 'Review answers' })).toBeVisible();
    await expect(next.getByRole('button', { name: /Retake quiz/ })).toBeVisible();
    await shotEl(next, 'quiz-next-pass');
    await next.locator('[data-next-primary]').filter({ hasText: 'Mark Day 2 complete & start Day 3 →' }).click();
    await expect(page).toHaveURL(/\/day\/03(#.*)?$/);
    expect((await readProgress(page))?.days['2']?.status).toBe('completed');
  });
});

