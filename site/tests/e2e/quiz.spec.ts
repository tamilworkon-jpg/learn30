import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { expect, test, type Page } from './fixtures';
import type { Question } from '../../src/lib/types';
import { noHorizontalScroll, shotEl, trackConsole } from './helpers';

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
      .getByRole('button', { name: current < i ? 'Next →' : '← Previous' })
      .click();
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

    // single (correct)
    const s = qs[idx('single')];
    await goTo(page, idx('single'));
    const submitAnswer = quiz(page).locator('[data-submit-answer]');
    await expect(quiz(page).locator('.q-req')).toHaveText(/Single answer · choose 1/);
    await expect(quiz(page).locator('input.opt-input[type="radio"]')).toHaveCount(s.options.length);
    await expect(quiz(page).locator('input.opt-input[type="radio"]').first()).toBeVisible();
    await expect(submitAnswer).toBeDisabled();
    await quiz(page).locator('label.opt').filter({ hasText: s.options.find((o) => o.id === (s.answer as string[])[0])!.text }).click();
    await expect(quiz(page).locator('label.opt-selected')).toHaveCount(1);
    await expect(submitAnswer).toBeEnabled();
    await shotEl(quiz(page), 'quiz-single');
    // practice: submitting one answer reveals it and locks the question
    await submitAnswer.click();
    await expect(quiz(page).locator('[data-feedback]')).toHaveAttribute('data-correct', 'true');
    await expect(quiz(page).locator('[data-feedback]')).toContainText('Correct');
    await expect(quiz(page).locator('input.opt-input[type="radio"]:disabled')).toHaveCount(s.options.length);
    await expect(quiz(page).locator('label.opt-correct')).toHaveCount(1);
    await expect(quiz(page).getByRole('button', { name: 'Next question →' })).toBeVisible();
    await shotEl(quiz(page), 'quiz-single-checked');

    // multi (correct)
    const m = qs[idx('multi')];
    await goTo(page, idx('multi'));
    const need = (m.answer as string[]).length;
    await expect(quiz(page).locator('.q-hint')).toContainText(`Select ${['', 'ONE', 'TWO', 'THREE'][need]}`);
    await expect(quiz(page).locator('.q-req')).toHaveText(new RegExp(`Multiple answers · choose ${need}`));
    await expect(quiz(page).locator('input.opt-input[type="checkbox"]').first()).toBeVisible();
    await expect(submitAnswer).toBeDisabled();
    await shotEl(quiz(page), 'quiz-multi');
    const optLabel = (id: string) => quiz(page).locator('label.opt').filter({ hasText: m.options.find((o) => o.id === id)!.text });
    for (const [k, id] of (m.answer as string[]).entries()) {
      if (k === need - 1) await expect(submitAnswer).toBeDisabled(); // one short of the requirement
      await optLabel(id).click();
    }
    await expect(quiz(page).locator('.q-hint')).toContainText(`${need} selected`);
    await expect(submitAnswer).toBeEnabled();
    // at the limit the other options are disabled until one is unticked
    await expect(quiz(page).locator('[data-limit]')).toContainText(`You've chosen ${need} of ${need}`);
    await expect(quiz(page).locator('input.opt-input[type="checkbox"]:disabled')).toHaveCount(m.options.length - need);
    await shotEl(quiz(page), 'quiz-multi-limit');
    await optLabel((m.answer as string[])[0]).click();
    await expect(quiz(page).locator('input.opt-input[type="checkbox"]:disabled')).toHaveCount(0);
    await expect(submitAnswer).toBeDisabled();
    await optLabel((m.answer as string[])[0]).click();
    await expect(submitAnswer).toBeEnabled();

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

    // Q-E2 submit with 16 unanswered → confirmation, "go to first unanswered" cancels
    await quiz(page).getByRole('button', { name: 'Submit now' }).click();
    const dialog = quiz(page).getByRole('alertdialog');
    await expect(dialog).toContainText('Submit with 16 unanswered questions?');
    await dialog.getByRole('button', { name: 'Go to first unanswered' }).click();
    await expect(dialog).toBeHidden();
    await expect(quiz(page)).toContainText(`Question ${qs.findIndex((_, i) => ![idx('single'), idx('multi'), idx('ordering'), idx('matching')].includes(i)) + 1} of 20`);
    await quiz(page).getByRole('button', { name: 'Submit now' }).click();
    await quiz(page).getByRole('alertdialog').getByRole('button', { name: 'Submit anyway' }).click();

    // Q-E3 results
    const results = quiz(page).locator('.quiz-results');
    await expect(results.getByRole('img', { name: 'Score 20 percent' })).toBeVisible();
    await expect(results).toContainText('4 / 20');
    await expect(results.locator('.review-item')).toHaveCount(20);
    await expect(results.locator('.review-item[data-correct="true"]')).toHaveCount(4);
    const wrong = results.locator('.review-item[data-correct="false"]').first();
    await expect(wrong).toContainText('Your answer: Not answered');
    await expect(wrong).toContainText('Correct answer:');
    await wrong.locator('details.opt-explain summary').click();
    const wq = qs.find((q) => wrong && q.stem && !([idx('single'), idx('multi'), idx('ordering'), idx('matching')].map((i) => qs[i].id).includes(q.id)))!;
    for (const op of wq.options) await expect(wrong).toContainText(op.explanation);
    await expect(wrong.getByRole('link', { name: 'Review in lesson →' })).toHaveAttribute('href', `/day/02#${wq.lessonRef.split('#')[1]}`);
    await noHorizontalScroll(page);
    await shotEl(results, 'quiz-results');

    // Q-E4 best score survives reload; in-progress answers were cleared by submit
    await page.reload();
    await page.locator('.quiz-slot').scrollIntoViewIfNeeded();
    await expect(quiz(page)).toHaveAttribute('data-ready', 'true');
    await expect(quiz(page)).toContainText('Best score: 20%');
    await expect(quiz(page)).toContainText('0 / 20 answered');

    // Q-E5 retake from results starts empty at question 1
    await quiz(page).getByRole('button', { name: 'Submit now' }).click();
    await quiz(page).getByRole('alertdialog').getByRole('button', { name: 'Submit anyway' }).click();
    await expect(quiz(page).locator('.quiz-results')).toContainText('0 / 20');
    await expect(quiz(page).locator('.quiz-results')).toContainText('Best score: 20%');
    await quiz(page).getByRole('button', { name: /Retake quiz/ }).click();
    await expect(quiz(page)).toContainText('Question 1 of 20');
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
    // Tab to "Next" (Previous may be disabled) and activate with Enter → focus lands on the new question
    await quiz(page).getByRole('button', { name: 'Next →' }).focus();
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
});
