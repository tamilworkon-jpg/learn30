import AxeBuilder from '@axe-core/playwright';
import { DASH, expect, test } from './fixtures';
import { done, progress, seed } from './progress-fixtures';
import { seedTheme } from './routes';
import { noHorizontalScroll, trackConsole } from './helpers';

// Course catalogue (home `/`, T205; the old /courses redirects there): public; signed in it shows the learner's progress and continues the course.
const card = (page: import('@playwright/test').Page) => page.locator('[data-course="aws-ai-practitioner"]');

test.describe('courses catalogue', () => {
  test('CO1 signed in: Courses is the first nav item; the card shows progress and continues the course', async ({ page }) => {
    const problems = trackConsole(page);
    await seed(page, progress({ days: { '1': done(), '2': done() } }));
    await page.goto('/');
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
    await expect(card(page).getByRole('link', { name: 'Continue Day 3 →' })).toHaveAttribute('href', '/course/aws-ai-practitioner/day/03');
    await expect(card(page).getByRole('link', { name: 'Course outline' })).toHaveAttribute('href', '/course/aws-ai-practitioner/outline');
    // Learn30: platform pages carry no course group and no course facts.
    await expect(page.locator('#nav-course-h')).toHaveCount(0);
    await expect(page.locator('[data-course-card]')).toHaveCount(0);
    await expect(page.locator('footer')).toHaveText(/Learn30 — independent study aid/);
    await expect(page).toHaveTitle(/· Learn30$/);
    await noHorizontalScroll(page);
    // The dashboard (inside the course) names the course it belongs to; the sidebar groups the course's pages.
    await page.goto(DASH);
    await expect(page.locator('#nav-course-h')).toHaveText('AWS AI Practitioner');
    await expect(page.getByRole('group', { name: 'AWS AI Practitioner' }).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-course-crumb]')).toContainText('AWS Certified AI Practitioner');
    await expect(page.locator('html')).toHaveAttribute('data-course', 'aws-ai-practitioner');
    await expect(page.locator('[data-course-card]')).toContainText('AIF-C01 · v1.2');
    await expect(page.locator('[data-course-crumb]').getByRole('link', { name: 'Courses' })).toHaveAttribute('href', '/');
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('CO2 new learner: Start course → Day 1 entry', async ({ page }) => {
    await page.goto('/courses'); // old address → 301 to the catalogue
    await expect(page).toHaveURL(/\/$/);
    await expect(card(page).locator('[data-course-progress]')).toContainText('0 of 30 days');
    await expect(card(page).getByRole('link', { name: 'Start course →' })).toHaveAttribute('href', DASH);
  });

  test.describe('signed out', () => {
    test.use({ signedIn: false });
    test('CO3 the catalogue is public; the card invites sign-in instead of showing progress', async ({ page }) => {
      const res = await page.goto('/');
      expect(res?.status()).toBe(200);
      await expect(page).toHaveURL(/\/$/);
      await expect(card(page)).toContainText('Sign in to track your progress');
      await expect(card(page).locator('[data-course-progress]')).toHaveCount(0);
      await expect(card(page).getByRole('link', { name: 'Sign in to start →' })).toHaveAttribute('href', `/login?next=${encodeURIComponent(DASH)}`);
    });
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`CO4 axe clean (${theme})`, async ({ page }) => {
      await seedTheme(page, theme);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      const r = await new AxeBuilder({ page }).analyze();
      const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id);
      expect(bad).toEqual([]);
    });
  }
});
