import { COURSE, DEMO, courseHref, expect, getCourseProgress, putCourseProgress, settleSaves, test, type Page } from './fixtures';
import { done, progress } from './progress-fixtures';
import { trackConsole } from './helpers';

// Learn30 (spec 002 — US1–US5): the platform hosts several courses. The e2e build adds the test-only fixture
// course `demo-course` (tests/fixtures/courses, AIP_FIXTURE_COURSES=1) next to the AWS course, which proves:
// a catalogue of courses, a menu that follows the selected course, separate progress per course, old links
// redirecting into the AWS course, neutral branding on global pages and search scoped to one course.
const card = (page: Page, id: string) => page.locator(`[data-course="${id}"]`);
const AWS_TITLE = 'AWS AI Practitioner';
const DEMO_TITLE = 'Demo Course';

test.describe('multi-course platform (spec 002) @sanity', () => {
  test('MC1 catalogue: one card per course, each with its own progress', async ({ page }) => {
    const problems = trackConsole(page);
    await putCourseProgress(page.request, COURSE, progress({ days: { '1': done(), '2': done() } }));
    await putCourseProgress(page.request, DEMO, progress({ days: { '1': done() } }));
    await page.goto('/');
    await expect(page.locator('[data-courses]')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('[data-course]')).toHaveCount(2);
    await expect(card(page, COURSE).locator('[data-course-progress]')).toContainText('2 of 30 days');
    await expect(card(page, DEMO)).toContainText('Demo Course for Tests');
    await expect(card(page, DEMO).locator('[data-course-progress]')).toContainText('1 of 3 days');
    await expect(card(page, DEMO).getByRole('link', { name: /Continue Day 2/ })).toHaveAttribute('href', courseHref(DEMO, 'day', 2));
    await expect(card(page, COURSE).getByRole('link', { name: /Continue Day 3/ })).toHaveAttribute('href', courseHref(COURSE, 'day', 3));
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('MC2 the menu follows the selected course; global pages show no course group', async ({ page }) => {
    await page.goto(courseHref(DEMO, 'day', 1));
    const group = page.getByRole('group', { name: DEMO_TITLE });
    await expect(group).toBeVisible();
    await expect(page.getByRole('group', { name: AWS_TITLE })).toHaveCount(0);
    const hrefs = await group.getByRole('link').evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThanOrEqual(5);
    for (const h of hrefs) expect(h, 'every course link stays inside the demo course').toMatch(/^\/course\/demo-course(\/|$)/);
    await expect(group.getByRole('link', { name: 'Outline' })).toHaveAttribute('aria-current', 'page');

    await page.goto(courseHref(COURSE, 'outline'));
    await expect(page.getByRole('group', { name: AWS_TITLE })).toBeVisible();
    await expect(page.getByRole('group', { name: DEMO_TITLE })).toHaveCount(0);

    for (const path of ['/', '/settings']) {
      await page.goto(path);
      const nav = page.getByRole('navigation', { name: 'Main navigation' });
      await expect(nav.getByRole('link', { name: 'Courses' })).toBeVisible();
      await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible();
      await expect(nav.getByRole('group', { name: AWS_TITLE }), `${path}: no course group`).toHaveCount(0);
      await expect(nav.getByRole('group', { name: DEMO_TITLE }), `${path}: no course group`).toHaveCount(0);
    }
  });

  test('MC3 progress is separate per course', async ({ page }) => {
    await putCourseProgress(page.request, COURSE, progress({ days: { '1': done() } }));
    const awsBefore = await getCourseProgress(page.request, COURSE);
    await page.goto(courseHref(DEMO, 'day', 1));
    const mc = page.locator('[data-mark-complete="1"]');
    await mc.scrollIntoViewIfNeeded();
    await expect(mc).toHaveAttribute('data-ready', 'true');
    await mc.getByRole('button', { name: 'Mark Day 1 complete' }).click();
    await expect(mc).toContainText('Day 1 completed');
    await settleSaves(page);
    expect((await getCourseProgress(page.request, DEMO))?.days['1']?.status).toBe('completed');
    const awsAfter = await getCourseProgress(page.request, COURSE);
    expect(awsAfter?.days, 'the AWS course is untouched').toEqual(awsBefore?.days);
    // A fresh course starts empty.
    await page.goto(courseHref(DEMO));
    await expect(page.locator('[data-dashboard]')).toContainText('1 of 3 days');
  });

  test('MC4 old addresses redirect into the AWS course (301, hash kept)', async ({ page }) => {
    for (const [from, to] of [
      ['/day/02', courseHref(COURSE, 'day', 2)],
      ['/outline', courseHref(COURSE, 'outline')],
      ['/mock/1', courseHref(COURSE, 'mock', 1)],
      ['/glossary', courseHref(COURSE, 'glossary')],
      ['/cheatsheet/metrics', courseHref(COURSE, 'cheatsheet', 'metrics')],
      ['/coverage', courseHref(COURSE, 'coverage')],
      ['/search', courseHref(COURSE, 'search')],
    ] as const) {
      const r = await page.request.get(from, { maxRedirects: 0 });
      expect(r.status(), from).toBe(301);
      expect(new URL(r.headers()['location'] ?? '', 'http://x').pathname, from).toBe(to);
    }
    await page.goto('/day/02#explanation');
    await expect(page).toHaveURL(new RegExp(`${courseHref(COURSE, 'day', 2)}#explanation$`));
  });

  test('MC5 global pages are course-neutral (Learn30 branding, no exam facts)', async ({ page }) => {
    for (const path of ['/', '/settings']) {
      await page.goto(path);
      await expect(page).toHaveTitle(/Learn30/);
      const text = await page.locator('body').innerText();
      // The catalogue card may name the course; nothing else on a global page should.
      const outsideCards = await page.evaluate(() => {
        const clone = document.body.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[data-course]').forEach((n) => n.remove());
        return clone.innerText;
      });
      expect(text.length).toBeGreaterThan(0);
      expect(outsideCards, `${path} outside the course cards`).not.toMatch(/AI Practitioner|AIF-C01|AIP · 30|not affiliated with AWS/);
    }
    // Course pages carry their own facts.
    await page.goto(courseHref(COURSE, 'day', 1));
    await expect(page.locator('footer, .site-footer').first()).toContainText('AIF-C01');
    await page.goto(courseHref(DEMO, 'day', 1));
    await expect(page.locator('body')).not.toContainText('AIF-C01');
  });

  test('MC6 search is scoped to the current course', async ({ page }) => {
    // "flashcards" only appears in the demo course; "Bedrock" only in the AWS course.
    const links = page.locator('.pagefind-ui__result-link');
    const hrefs = () => links.evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? ''));
    await page.goto(`${courseHref(DEMO, 'search')}?q=flashcards`);
    await expect(links.first()).toBeVisible();
    for (const h of await hrefs()) expect(h).toMatch(/\/course\/demo-course\//);
    await page.goto(`${courseHref(DEMO, 'search')}?q=bedrock`);
    await expect(page.locator('.pagefind-ui__message')).toContainText(/No results/i);
    await expect(links).toHaveCount(0);
    await page.goto(`${courseHref(COURSE, 'search')}?q=bedrock`);
    await expect(links.first()).toBeVisible();
    for (const h of await hrefs()) expect(h).toMatch(/\/course\/aws-ai-practitioner\//);
  });
});
