import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { done, progress, seed } from './progress-fixtures';
import { seedTheme } from './routes';
import { noHorizontalScroll, trackConsole } from './helpers';

// Course catalogue (/courses): public; signed in it shows the learner's progress and continues the course.
const card = (page: import('@playwright/test').Page) => page.locator('[data-course="aws-ai-practitioner"]');

test.describe('courses catalogue', () => {
  test('CO1 signed in: Courses is the first nav item; the card shows progress and continues the course', async ({ page }) => {
    const problems = trackConsole(page);
    await seed(page, progress({ days: { '1': done(), '2': done() } }));
    await page.goto('/courses');
    const nav = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link');
    await expect(nav.first()).toHaveText('Courses');
    await expect(nav.first()).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Courses');
    await expect(page.locator('[data-courses]')).toHaveAttribute('data-ready', 'true');
    await expect(card(page)).toContainText('AWS Certified AI Practitioner');
    await expect(card(page)).toContainText('AIF-C01');
    await expect(card(page)).toContainText('30 days · ~1 h/day · weekdays');
    await expect(card(page).locator('[data-course-progress]')).toContainText('2 of 30 days');
    await expect(card(page).locator('[data-course-progress]')).toContainText('7%');
    await expect(card(page).getByRole('link', { name: 'Continue Day 3 →' })).toHaveAttribute('href', '/day/03');
    await expect(card(page).getByRole('link', { name: 'Course outline' })).toHaveAttribute('href', '/outline');
    await noHorizontalScroll(page);
    // The dashboard names the course it belongs to.
    await page.goto('/');
    await expect(page.locator('[data-course-crumb]')).toContainText('AWS Certified AI Practitioner');
    await expect(page.locator('[data-course-crumb]').getByRole('link', { name: 'Courses' })).toHaveAttribute('href', '/courses');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('CO2 new learner: Start course → Day 1 entry', async ({ page }) => {
    await page.goto('/courses');
    await expect(card(page).locator('[data-course-progress]')).toContainText('0 of 30 days');
    await expect(card(page).getByRole('link', { name: 'Start course →' })).toHaveAttribute('href', '/');
  });

  test.describe('signed out', () => {
    test.use({ signedIn: false });
    test('CO3 the catalogue is public; the card invites sign-in instead of showing progress', async ({ page }) => {
      const res = await page.goto('/courses');
      expect(res?.status()).toBe(200);
      await expect(page).toHaveURL(/\/courses$/);
      await expect(card(page)).toContainText('Sign in to track your progress');
      await expect(card(page).locator('[data-course-progress]')).toHaveCount(0);
      await expect(card(page).getByRole('link', { name: 'Sign in to start →' })).toHaveAttribute('href', '/login?next=%2F');
    });
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`CO4 axe clean (${theme})`, async ({ page }) => {
      await seedTheme(page, theme);
      await page.goto('/courses');
      await page.waitForLoadState('networkidle');
      const r = await new AxeBuilder({ page }).analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
      expect(bad).toEqual([]);
    });
  }
});
