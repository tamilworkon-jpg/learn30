import { expect, test } from '@playwright/test';
import { shot, shotEl } from './helpers';
import { done, progress, seed } from './progress-fixtures';

// T183 — plan dates from the browser's current date (clock frozen for determinism; en-US locale in Playwright).
const START = new Date(2026, 10, 2).toISOString(); // Mon 2 Nov 2026, local midnight
const TODAY = new Date(2026, 10, 6, 10, 0, 0); // Fri 6 Nov 2026 → plan Day 5

test.describe('schedule dates (T183) @visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
    await seed(page, progress({ startedAt: START, days: { '1': done(), '2': done() } }));
  });

  test('SD2 dashboard shows start, finish, today and behind/ahead from the browser date', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-schedule]');
    await expect(card.locator('[data-sched-start]')).toHaveText(/Nov 2, 2026/);
    await expect(card.locator('[data-sched-finish]')).toHaveText(/Dec 1, 2026/);
    await expect(card.locator('[data-sched-today]')).toHaveText('Day 5 of your plan');
    await expect(card).toContainText('Nov 6, 2026');
    await expect(card.locator('[data-sched-status]')).toHaveText('2 days behind');
    await expect(card.locator('[data-sched-status]')).toHaveAttribute('data-state', 'behind');
    await shot(page, 'schedule-dashboard');

    await page.goto('/outline');
    await expect(page.locator('[data-outline]')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-day-row="1"] [data-plan-date]')).toHaveText(/Nov 2, 2026/);
    await expect(page.locator('[data-day-row="5"] [data-plan-date]')).toHaveText(/^Today · .*Nov 6, 2026/);
    await expect(page.locator('[data-day-row="30"] [data-plan-date]')).toHaveText(/Dec 1, 2026/);
    await expect(page.locator('[data-today]')).toHaveCount(1);
  });

  test('SD3 changing the start date in Settings updates dashboard and outline', async ({ page }) => {
    await page.goto('/settings');
    const s = page.locator('#schedule');
    await expect(page.locator('[data-learner-settings]')).toHaveAttribute('data-ready', 'true');
    await expect(s.locator('[data-start-input]')).toHaveValue('2026-11-02');
    await s.locator('[data-start-input]').fill('2026-11-05');
    await expect(s.locator('[data-finish-preview]')).toContainText('Dec 4, 2026');
    await s.getByRole('button', { name: 'Save start date' }).click();
    await expect(page.locator('[data-learner-settings]').getByRole('status')).toContainText('Start date saved');
    await shotEl(s, 'schedule-settings');

    await page.goto('/');
    const card = page.locator('[data-schedule]');
    await expect(card.locator('[data-sched-today]')).toHaveText('Day 2 of your plan');
    await expect(card.locator('[data-sched-finish]')).toHaveText(/Dec 4, 2026/);
    await expect(card.locator('[data-sched-status]')).toHaveText('1 day ahead');
    await page.goto('/outline');
    await expect(page.locator('[data-day-row="2"] [data-plan-date]')).toHaveText(/^Today · /);
  });
});
