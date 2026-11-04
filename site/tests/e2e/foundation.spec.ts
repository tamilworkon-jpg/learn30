import { DASH, expect, test } from './fixtures';
import { noHorizontalScroll, shot, trackConsole } from './helpers';

test.describe('foundation (T018) @visual', () => {
  test('F37–F40 home shell, nav, theme toggle, footer, CSP', async ({ page }) => {
    const problems = trackConsole(page);
    await page.goto(DASH);
    for (const label of ['Courses', 'Dashboard', 'Outline', 'Search', 'Glossary', 'Cheat sheets', 'Settings']) {
      await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: label })).toBeVisible();
    }
    await expect(page.locator('footer')).toContainText('exam guide v1.2 · last verified 2026-11-02');
    const csp = await page.locator('meta[http-equiv="content-security-policy" i]').getAttribute('content');
    expect(csp).toContain("default-src 'self'");
    await noHorizontalScroll(page);
    await shot(page, 'foundation-home-light');

    await page.getByRole('button', { name: /switch to dark theme/i }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await shot(page, 'foundation-home-dark');
    expect(problems, problems.join('\n')).toEqual([]);
  });
});
