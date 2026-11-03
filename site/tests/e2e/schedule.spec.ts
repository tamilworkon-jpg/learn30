import { expect, test } from './fixtures';
import { shot, shotEl } from './helpers';
import { done, progress, readProgress, seed } from './progress-fixtures';

// T183 — weekday-only plan dates (Mon–Fri) from the browser's current date (clock frozen for determinism; en-US locale in Playwright).
// The start date is part of the account's progress on the server (Phase 13).
const START = new Date(2026, 10, 2).toISOString(); // Mon 2 Nov 2026, local midnight
const TODAY = new Date(2026, 10, 6, 10, 0, 0); // Fri 6 Nov 2026 → plan Day 5

test.describe('schedule dates (T183) @visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(TODAY);
    await seed(page, progress({ startedAt: START, days: { '1': done(), '2': done() } }));
  });

  test('SD2 dashboard shows start (weekdays only), finish, today and behind/ahead from the browser date', async ({ page }) => {
    await page.goto('/');
    const card = page.locator('[data-schedule]');
    await expect(card.locator('[data-sched-start]')).toHaveText(/Nov 2, 2026/);
    await expect(card.locator('[data-sched-finish]')).toHaveText(/Dec 11, 2026/);
    await expect(card.locator('[data-sched-today]')).toHaveText('Day 5 of your plan');
    await expect(card).toContainText('Nov 6, 2026');
    await expect(card.locator('[data-sched-status]')).toHaveText('2 days behind');
    // Updated finish = original finish moved by the lag (2 study days later), recomputed on load.
    await expect(card.locator('[data-sched-projected]')).toHaveText(/Dec 15, 2026/);
    await expect(card.locator('[data-sched-projected-note]')).toHaveText('2 study days later than planned');
    await expect(card.locator('[data-sched-status]')).toHaveAttribute('data-state', 'behind');
    await shot(page, 'schedule-dashboard');

    await page.goto('/outline');
    await expect(page.locator('[data-outline]')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-day-row="1"] [data-plan-date]')).toHaveText(/Nov 2, 2026/);
    await expect(page.locator('[data-day-row="5"] [data-plan-date]')).toHaveText(/^Today · .*Nov 6, 2026/);
    await expect(page.locator('[data-day-row="30"] [data-plan-date]')).toHaveText(/Dec 11, 2026/);
    await expect(page.locator('[data-today]')).toHaveCount(1);

    // Day pages show their planned date (lesson + review layouts).
    await page.goto('/day/05');
    await expect(page.locator('[data-planned-day]')).toHaveText(/Planned for .*Nov 6, 2026 · today/);
    await page.goto('/day/07');
    await expect(page.locator('[data-planned-day]')).toHaveText(/Planned for .*Nov 10, 2026 · in 2 study days/);
  });

  test('SD3 changing the start date in Settings updates dashboard and outline', async ({ page }) => {
    await page.goto('/settings');
    const s = page.locator('#schedule');
    await expect(page.locator('[data-progress-io]')).toHaveAttribute('data-ready', 'true');
    await expect(s.locator('[data-start-input]')).toHaveValue('2026-11-02');
    await s.locator('[data-start-input]').fill('2026-11-05');
    await expect(s.locator('[data-finish-preview]')).toContainText('Dec 16, 2026');
    await s.getByRole('button', { name: 'Save start date' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Start date saved' })).toBeVisible();
    await shotEl(s, 'schedule-settings');

    await page.goto('/');
    const card = page.locator('[data-schedule]');
    await expect(card.locator('[data-sched-today]')).toHaveText('Day 2 of your plan');
    await expect(card.locator('[data-sched-finish]')).toHaveText(/Dec 16, 2026/);
    await expect(card.locator('[data-sched-status]')).toHaveText('1 day ahead');
    await expect(card.locator('[data-sched-projected]')).toHaveText(/Dec 15, 2026/);
    await expect(card.locator('[data-sched-projected-note]')).toHaveText('1 study day earlier than planned');
    await page.goto('/outline');
    await expect(page.locator('[data-day-row="2"] [data-plan-date]')).toHaveText(/^Today · /);
    // Saved on the server for this account (Phase 13), not in the browser.
    expect(new Date((await readProgress(page))!.startedAt).getDate()).toBe(5);
  });

  test('SD4 weekends are free: dashboard and outline point at Monday', async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 10, 7, 10, 0, 0)); // Sat 7 Nov 2026
    await page.goto('/');
    const card = page.locator('[data-schedule]');
    await expect(card.locator('[data-sched-today]')).toHaveText(/^Weekend · Day 6 on .*Nov 9, 2026/);
    await expect(card.locator('[data-sched-status]')).toHaveText('3 days behind');
    await expect(card.locator('[data-sched-projected]')).toHaveText(/Dec 16, 2026/);
    await page.goto('/outline');
    await expect(page.locator('[data-outline]')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-day-row="6"] [data-plan-date]')).toHaveText(/^Next · .*Nov 9, 2026/);
    await expect(page.locator('[data-day-row="5"] [data-plan-date]')).toHaveText(/Nov 6, 2026/);
    await page.goto('/day/06');
    await expect(page.locator('[data-planned-day]')).toHaveText(/Planned for .*Nov 9, 2026 · next study day/);
  });
});
