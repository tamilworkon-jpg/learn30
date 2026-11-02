import { expect, test } from '@playwright/test';
import { noHorizontalScroll, shot, trackConsole } from './helpers';

test.describe('lesson UI (T036) @visual', () => {
  test('U5 section nav lists all sections, highlights the current one, collapses on mobile', async ({ page, isMobile }, info) => {
    const problems = trackConsole(page);
    await page.goto('/day/02');
    const nav = page.getByRole('navigation', { name: "Today's sections" });
    const toggle = nav.locator('details.section-nav-toggle');
    const mobile = isMobile || info.project.name === 'mobile';
    if (mobile) {
      await expect(toggle).not.toHaveAttribute('open', '');
      await nav.locator('summary').click();
    } else {
      await nav.locator('summary').click(); // must stay expanded on desktop
    }
    await expect(toggle).toHaveAttribute('open', '');
    await expect(nav.getByRole('link')).toHaveCount(11);
    if (!mobile) await shot(page, 'lesson-nav');

    await page.evaluate(() => document.getElementById('examples')!.scrollIntoView({ block: 'start' }));
    await expect(nav.locator('[data-nav-for="examples"]')).toHaveAttribute('aria-current', 'true');
    await expect(nav.locator('[aria-current="true"]')).toHaveCount(1);

    if (mobile) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await nav.locator('[data-nav-for="real-world"]').click();
      await expect(toggle).not.toHaveAttribute('open', '');
      await shot(page, 'lesson-nav');
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('U6–U7 deep dive collapsed with Optional label; prev/next', async ({ page }) => {
    const problems = trackConsole(page);
    await page.goto('/day/02');
    const deep = page.locator('details.deep-dive');
    await expect(deep).not.toHaveAttribute('open', '');
    await expect(deep.locator('summary')).toContainText('Optional');
    await expect(deep.locator('summary')).toContainText(/Architect Deep Dive · .+\d+ min/);
    await deep.locator('summary').click();
    await expect(deep).toHaveAttribute('open', '');
    await expect(page.getByRole('link', { name: /Previous: Day 1/ })).toHaveAttribute('href', '/day/01');
    await expect(page.getByRole('link', { name: /Next: Day 3/ })).toHaveAttribute('href', '/day/03');
    await noHorizontalScroll(page);
    await shot(page, 'lesson-deepdive-open');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('U8 skip-ahead notice is shown, dismissible and non-blocking', async ({ page }) => {
    await page.goto('/day/03');
    const notice = page.getByRole('status').filter({ hasText: 'Day 2' });
    await expect(notice).toBeVisible();
    await notice.getByRole('button', { name: /dismiss/i }).click();
    await expect(notice).toBeHidden();
    await expect(page.locator('#explanation')).toBeVisible();
  });

  test('U9 Day 1 orientation shows exam format', async ({ page }) => {
    await page.goto('/day/01');
    const o = page.locator('#orientation');
    for (const t of ['65', '90 minutes', '700', 'Multiple choice', 'Multiple response', 'Ordering', 'Matching']) await expect(o).toContainText(t);
    await expect(page.locator('#recap')).toHaveCount(0);
    await shot(page, 'day1-orientation');
  });
});
