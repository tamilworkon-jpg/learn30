import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { noHorizontalScroll, shot, trackConsole } from './helpers';
import { attempt, done, progress, readProgress, seed } from './progress-fixtures';

// T065 — resume, dashboard progress, weak domains.
const dash = (page: Page) => page.locator('[data-dashboard]');

async function openDashboard(page: Page) {
  await page.goto('/');
  await expect(dash(page)).toHaveAttribute('data-ready', 'true');
}

async function seriousAxe(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

test.describe('resume & dashboard (T065) @visual', () => {
  test('fresh learner: 0 of 30, continue → Day 1, all 30 days reachable', async ({ page }) => {
    const problems = trackConsole(page);
    await openDashboard(page);
    await expect(dash(page)).toContainText('0 of 30 days complete');
    await expect(page.getByRole('link', { name: /Continue: Day 1/ })).toHaveAttribute('href', '/day/01');
    await expect(page.locator('.week-tile')).toHaveCount(7);
    await noHorizontalScroll(page);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('R5 complete Days 1–2, view Day 3 hands-on → 2/30 (7%), Day 3 in progress, Continue in 1 click', async ({ page }) => {
    const problems = trackConsole(page);
    await seed(page, progress({ days: { '1': done(), '2': done() } }));
    await page.goto('/day/03');
    // Re-anchor on every poll: late-loading images above can shift the section after the first scroll.
    const hands = page.locator('#hands-on');
    await expect
      .poll(
        async () => {
          await hands.evaluate((el) => el.scrollIntoView({ block: 'start' }));
          return (await readProgress(page))?.lastPosition?.sectionId;
        },
        { timeout: 15_000 },
      )
      .toBe('hands-on');
    expect((await readProgress(page))?.days['3']).toMatchObject({ status: 'in-progress', sectionsViewed: expect.arrayContaining(['hands-on']) });

    await openDashboard(page);
    await expect(dash(page)).toContainText('2 of 30 days complete');
    await expect(page.getByRole('img', { name: '7 percent complete' })).toBeVisible();
    await expect(dash(page)).toContainText('Day 3 of 30');
    await expect(page.locator('.week-tile[data-day="3"]')).toHaveAttribute('data-status', 'in-progress');
    await expect(page.locator('.week-tile[data-day="1"]')).toHaveAttribute('data-status', 'completed');
    await noHorizontalScroll(page);
    await shot(page, 'dashboard-resume');
    await seriousAxe(page);

    await page.getByRole('link', { name: /Continue: Day 3/ }).click();
    await expect(page).toHaveURL(/\/day\/03#hands-on$/);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('R5 dark theme dashboard', async ({ page }) => {
    await seed(page, progress({ settings: { theme: 'dark' }, days: { '1': done(), '2': done(), '3': { status: 'in-progress', sectionsViewed: ['recap', 'objectives'] } }, lastPosition: { day: 3, sectionId: 'explanation', updatedAt: '2026-10-22T09:00:00.000Z' }, attempts: [attempt('day-02', { D1: { correct: 6, total: 10 }, D4: { correct: 3, total: 6 } })] }));
    await openDashboard(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await shot(page, 'dashboard-resume-dark');
    await seriousAxe(page);
  });

  test('mark complete on a lesson updates the dashboard; undo reverts', async ({ page }) => {
    await page.goto('/day/01');
    const mc = page.locator('[data-mark-complete="1"]');
    await mc.scrollIntoViewIfNeeded();
    await expect(mc).toHaveAttribute('data-ready', 'true');
    await mc.getByRole('button', { name: 'Mark Day 1 complete' }).click();
    await expect(mc).toContainText('Day 1 completed');
    await expect(mc.getByRole('link', { name: 'Go to Day 2 →' })).toHaveAttribute('href', '/day/02');
    await openDashboard(page);
    await expect(dash(page)).toContainText('1 of 30 days complete');
    await expect(page.getByRole('link', { name: /Continue: Day 2/ })).toBeVisible();
    await page.goto('/day/01');
    await mc.scrollIntoViewIfNeeded();
    await mc.getByRole('button', { name: 'Undo' }).click();
    await expect(mc.getByRole('button', { name: 'Mark Day 1 complete' })).toBeVisible();
    await expect.poll(async () => (await readProgress(page))?.days['1'].status).toBe('in-progress');
  });

  test('R6 in-progress quiz answers are retained across navigation', async ({ page }) => {
    await page.goto('/day/03');
    const quiz = page.locator('[data-quiz="day-03"]');
    await page.locator('.quiz-slot').scrollIntoViewIfNeeded();
    await expect(quiz).toHaveAttribute('data-ready', 'true');
    await quiz.locator('label.opt').first().click();
    await expect(quiz).toContainText(/^.*1 \/ \d+ answered/);
    await openDashboard(page);
    await page.goto('/day/03');
    await page.locator('.quiz-slot').scrollIntoViewIfNeeded();
    await expect(quiz).toHaveAttribute('data-ready', 'true');
    await expect(quiz).toContainText(/1 \/ \d+ answered/);
  });

  test('R7 weak domains widget lists low domains with revisit links', async ({ page }) => {
    await seed(page, progress({ days: { '1': done(), '2': done() }, attempts: [attempt('day-01', { D1: { correct: 6, total: 10 } }), attempt('day-02', { D4: { correct: 1, total: 5 }, D3: { correct: 1, total: 2 } })] }));
    await openDashboard(page);
    const weak = page.locator('[data-weak-domains]');
    await expect(weak.locator('[data-domain]')).toHaveCount(2);
    await expect(weak.locator('[data-domain]').nth(0)).toContainText('D4 · 20%');
    await expect(weak.locator('[data-domain]').nth(1)).toContainText('D1 · 60%');
    await expect(weak.getByRole('link', { name: /Day 2/ }).first()).toHaveAttribute('href', '/day/02');
    await expect(weak).not.toContainText('D3');
  });
});
