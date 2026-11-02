import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { shot, shotEl, trackConsole } from './helpers';
import { done, progress, seed } from './progress-fixtures';

// T184 — local learner profiles: separate progress per learner in one browser.
const dash = (page: Page) => page.locator('[data-dashboard]');
const menu = (page: Page) => page.locator('[data-profile-menu]');

async function openMenu(page: Page) {
  await expect(menu(page)).toHaveAttribute('data-ready', 'true');
  await menu(page).getByRole('button', { name: /Switch learner/ }).click();
  return menu(page).getByRole('dialog', { name: "Who's learning?" });
}

test.describe('local profiles (T184) @visual', () => {
  test('PR2 two learners keep separate progress, dashboards and avatars; PR4 axe', async ({ page }) => {
    const problems = trackConsole(page);
    await seed(page, progress({ days: { '1': done(), '2': done() } }));
    await page.goto('/');
    await expect(dash(page)).toContainText('2 of 30 days complete');
    await expect(menu(page).getByRole('button', { name: 'Learner: Learner. Switch learner' })).toBeVisible();

    const panel = await openMenu(page);
    await expect(panel.locator('[data-profile-item]')).toHaveCount(1);
    expect((await new AxeBuilder({ page }).include('[data-profile-menu]').analyze()).violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([]);
    await panel.getByRole('button', { name: '+ Add learner' }).click();
    await panel.getByLabel("New learner's name").fill('Sam Lee');
    await shotEl(panel, 'profiles-menu');
    await panel.getByRole('button', { name: 'Add', exact: true }).click();

    // Reloaded as Sam: fresh progress, own avatar initials.
    await expect(dash(page)).toHaveAttribute('data-ready', 'true');
    await expect(menu(page).getByRole('button', { name: 'Learner: Sam Lee. Switch learner' })).toBeVisible();
    await expect(menu(page).locator('.profile-trigger .avatar')).toHaveText('SL');
    await expect(dash(page)).toContainText('0 of 30 days complete');
    await shot(page, 'profiles-dashboard');

    // Switch back: the first learner's progress is untouched.
    const panel2 = await openMenu(page);
    await expect(panel2.locator('[data-profile-item]')).toHaveCount(2);
    await panel2.locator('[data-profile-item="default"]').click();
    await expect(dash(page)).toHaveAttribute('data-ready', 'true');
    await expect(dash(page)).toContainText('2 of 30 days complete');
    await page.reload();
    await expect(dash(page)).toContainText('2 of 30 days complete');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('PR3 import into one learner leaves the other untouched; rename + delete in Settings', async ({ page }) => {
    await seed(page, progress({ days: { '1': done(), '2': done() } }));
    await page.goto('/settings');
    const learners = page.locator('[data-learner-settings]');
    await expect(learners).toHaveAttribute('data-ready', 'true');
    await learners.getByLabel("New learner's name").fill('Kim');
    await learners.getByRole('button', { name: 'Add learner' }).click();
    await expect(learners.getByRole('status')).toContainText('Kim');
    const kimRow = learners.locator('[data-learner]').filter({ hasText: 'Kim' });
    await kimRow.getByRole('button', { name: 'Switch to' }).click();
    await expect(learners).toHaveAttribute('data-ready', 'true');
    await expect(learners.locator('[data-learner]').filter({ hasText: '(current)' })).toContainText('Kim');

    // Import 5 completed days into Kim.
    const file = { name: 'kim.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(progress({ days: Object.fromEntries([1, 2, 3, 4, 5].map((d) => [String(d), done()])) }))) };
    const io = page.locator('[data-progress-io]');
    await io.getByLabel('Import progress file').setInputFiles(file);
    await io.getByRole('button', { name: 'Replace my progress' }).click();
    await expect(io.getByRole('status')).toContainText('Progress imported');
    await page.goto('/');
    await expect(dash(page)).toContainText('5 of 30 days complete');

    // Rename Kim, then delete Kim (with confirmation) → back to the first learner with 2 days.
    await page.goto('/settings');
    await expect(learners).toHaveAttribute('data-ready', 'true');
    await learners.getByRole('button', { name: 'Rename Kim' }).click();
    await learners.getByLabel('New name for Kim').fill('Kimberly');
    await learners.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(learners.locator('[data-learner]').filter({ hasText: 'Kimberly' })).toBeVisible();
    await learners.getByRole('button', { name: 'Delete Kimberly' }).click();
    await learners.getByRole('alertdialog').getByRole('button', { name: 'Yes, delete Kimberly' }).click();
    await expect(learners).toHaveAttribute('data-ready', 'true');
    await expect(learners.locator('[data-learner]')).toHaveCount(1);
    await page.goto('/');
    await expect(dash(page)).toContainText('2 of 30 days complete');
  });
});
