import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { noHorizontalScroll, shot, trackConsole } from './helpers';
import { done, progress, seed } from './progress-fixtures';

// T067 — R12 weeks → days → sections with status icons + domain chips; pending days "Coming soon".
test.describe('outline (T067) @visual', () => {
  test('R12 structure, status icons, chips, coming soon', async ({ page }) => {
    const problems = trackConsole(page);
    await seed(page, progress({ days: { '1': done(), '2': done(), '3': { status: 'in-progress', sectionsViewed: ['recap', 'objectives'] } } }));
    await page.goto('/outline');
    const root = page.locator('[data-outline]');
    await expect(root).toHaveAttribute('data-ready', 'true');

    await expect(root.locator('[data-week]')).toHaveCount(5);
    await expect(root.locator('[data-week="1"] h2')).toContainText('Week 1');
    await expect(root.locator('[data-day-row]')).toHaveCount(30);

    const d1 = root.locator('[data-day-row="1"]');
    await expect(d1).toHaveAttribute('data-status', 'completed');
    await expect(d1.locator('.status-icon')).toHaveAccessibleName('Completed');
    await expect(d1.locator('.chip-D1')).toBeVisible();
    const d3 = root.locator('[data-day-row="3"]');
    await expect(d3).toHaveAttribute('data-status', 'in-progress');
    await expect(d3.locator('[data-section="recap"]')).toHaveAttribute('data-viewed', 'true');
    await expect(d3.locator('[data-section="hands-on"]')).toHaveAttribute('data-viewed', 'false');
    await expect(d3.locator('[data-section="hands-on"] a')).toHaveAttribute('href', '/day/03#hands-on');
    await expect(root.locator('[data-day-row="4"]')).toHaveAttribute('data-status', 'not-started');
    await expect(root.locator('[data-day-row="4"]')).toContainText('Coming soon');
    await expect(root.locator('[data-day-row="10"] .chip-D2')).toBeVisible();
    await expect(root.locator('[data-day-row="10"] .chip-D3')).toBeVisible();
    await expect(root.locator('[data-day-row="1"]')).not.toContainText('Coming soon');

    await noHorizontalScroll(page);
    await shot(page, 'outline');
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
