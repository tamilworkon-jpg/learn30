import AxeBuilder from '@axe-core/playwright';
import { DASH, API_HEADERS, expect, getProgress, getUi, newAccount, putUi, settleSaves, signUp, signedInContext, test, type Page } from './fixtures';
import { shot, shotEl, trackConsole } from './helpers';
import { done, progress } from './progress-fixtures';

// T190 / contracts/server-api.md — accounts replace local profiles (T184): one login = one learner, progress and
// UI state live on the server. Client hooks: data-login-form, data-signup-form, data-account-menu,
// data-signed-out-banner, data-import-offer, data-save-status.
const dash = (page: Page) => page.locator('[data-dashboard]');
const menu = (page: Page) => page.locator('[data-account-menu]');
const loginUrl = (next: string) => new RegExp(`/login\\?next=(${encodeURIComponent(next)}|${next.replace(/\//g, '\\/')})$`);
const sessionCookie = async (page: Page) => (await page.context().cookies()).find((c) => c.name === 'aip_session' && c.value !== '');

async function seriousAxe(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
}

async function fillLogin(page: Page, username: string, password: string) {
  const form = page.locator('[data-login-form]');
  await form.getByLabel('Username').fill(username);
  await form.getByLabel('Password').fill(password);
  await form.getByRole('button', { name: 'Sign in' }).click();
}

async function openMenu(page: Page) {
  await expect(menu(page)).toBeVisible();
  await menu(page).getByRole('button').first().click();
  await expect(menu(page).getByRole('button', { name: 'Log out' })).toBeVisible();
}

test.describe('accounts (T190) @visual', () => {
  test.describe('signed out', () => {
    test.use({ signedIn: false });

    test('AU1 sign up → dashboard with the new account in the header', async ({ page, account }) => {
      const problems = trackConsole(page);
      await page.goto('/signup');
      const form = page.locator('[data-signup-form]');
      await expect(form).toBeVisible();
      await form.getByLabel('Username').fill(account.username);
      await form.getByLabel('Display name').fill('Ada Lovelace');
      await form.getByLabel('Password').fill(account.password);
      await shot(page, 'signup');
      await form.getByRole('button', { name: 'Create account' }).click();
      // No `next`: sign-up lands on the course catalogue (home), which starts the course.
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('[data-course="aws-ai-practitioner"]').getByRole('link', { name: 'Start course →' })).toHaveAttribute('href', DASH);
      await page.goto(DASH);
      await expect(dash(page)).toHaveAttribute('data-ready', 'true');
      await expect(dash(page)).toContainText('0 of 30 days complete');
      await expect(menu(page)).toContainText('AL');
      expect(await sessionCookie(page)).toBeTruthy();
      const me = await page.request.get('/api/me');
      expect((await me.json()).user).toMatchObject({ username: account.username, displayName: 'Ada Lovelace' });
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test('AU3 log in from a protected page returns to `next`', async ({ page, request, account }) => {
      await signUp(request, account); // separate API context: the page stays signed out
      await page.goto('/settings');
      await expect(page).toHaveURL(loginUrl('/settings'));
      await expect(page.locator('[data-login-form]')).toBeVisible();
      await shot(page, 'login');
      await fillLogin(page, account.username, account.password);
      await expect(page).toHaveURL(/\/settings$/);
      await expect(page.locator('[data-progress-io]')).toHaveAttribute('data-ready', 'true');
      // signed in: /login sends you home
      await page.goto('/login');
      await expect(page).toHaveURL(/\/$/);
    });

    test('AU4 wrong password → generic error, no session cookie', async ({ page, request, account }) => {
      await signUp(request, account);
      await page.goto('/login');
      await fillLogin(page, account.username, 'wrong-password-123');
      const form = page.locator('[data-login-form]');
      await expect(form.getByRole('alert')).toHaveText(/Incorrect username or password\./);
      await expect(page).toHaveURL(/\/login/);
      expect(await sessionCookie(page)).toBeUndefined();
      // an unknown username gets exactly the same message
      await fillLogin(page, newAccount().username, 'wrong-password-123');
      await expect(form.getByRole('alert')).toHaveText(/Incorrect username or password\./);
      expect(await sessionCookie(page)).toBeUndefined();
      expect((await page.request.get('/api/me')).status()).toBe(401);
    });

    test('AU6 signed out on a lesson: banner, quiz works in memory, nothing saved', async ({ page }) => {
      // Three slide-view loads of /day/02 (signed out = default view): > 30 s on mobile under parallel workers.
      test.slow();
      const problems = trackConsole(page);
      await page.goto('/day/02');
      const banner = page.locator('[data-signed-out-banner]');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText('Sign in to save your progress');
      await expect(banner.getByRole('link')).toHaveAttribute('href', /^\/login\?next=/);

      await page.goto('/day/02#quiz');
      const quiz = page.locator('[data-quiz="day-02"]');
      await quiz.scrollIntoViewIfNeeded();
      await expect(quiz).toHaveAttribute('data-ready', 'true');
      await quiz.locator('label.opt').first().click();
      await expect(quiz).toContainText(/1 \/ \d+ answered/);
      await settleSaves(page);
      // nothing written to the server or to localStorage progress keys
      expect((await page.request.get('/api/progress')).status()).toBe(401);
      expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('aip-course') || k.startsWith('aip-profiles')))).toEqual([]);
      await page.reload();
      // The deck restores the quiz slide and re-pages once the web font lands, so the box can still be
      // moving here; scroll without Playwright's "stable" wait (it times out under parallel load) and
      // retry until the island has hydrated.
      await expect(async () => {
        await quiz.evaluate((e) => e.scrollIntoView({ block: 'center' }));
        await expect(quiz).toHaveAttribute('data-ready', 'true', { timeout: 2000 });
      }).toPass({ timeout: 30000 });
      await expect(quiz).not.toContainText(/\b1 \/ \d+ answered/);
      expect(problems, problems.join('\n')).toEqual([]);
    });

    test('AU7 legacy browser progress → import offer appears once and imports', async ({ page, account }) => {
      // progress saved by the pre-accounts version of the site in this browser
      await page.goto('/login');
      const legacy = progress({ days: { '1': done(), '2': done(), '3': done() } });
      await page.evaluate((json) => localStorage.setItem('aip-course:v1', json), JSON.stringify(legacy));

      await page.goto('/signup');
      const form = page.locator('[data-signup-form]');
      await form.getByLabel('Username').fill(account.username);
      await form.getByLabel('Display name').fill(account.displayName);
      await form.getByLabel('Password').fill(account.password);
      await form.getByRole('button', { name: 'Create account' }).click();
      await expect(page).toHaveURL(/\/$/);

      const offer = page.locator('[data-import-offer]');
      await expect(offer).toBeVisible();
      await expect(offer).toContainText(/Import progress saved in this browser/i);
      await shotEl(offer, 'import-offer');
      await offer.getByRole('button', { name: /Import/ }).click();
      // Sign-up lands on the course catalogue (T205): the course card picks the imported progress up.
      await expect(page.locator('[data-course="aws-ai-practitioner"] [data-course-progress]')).toContainText('3 of 30 days');
      await settleSaves(page);
      expect(Object.keys((await getProgress(page.request))!.days).sort()).toEqual(['1', '2', '3']);

      await page.goto(DASH);
      await expect(dash(page)).toHaveAttribute('data-ready', 'true');
      await expect(dash(page)).toContainText('3 of 30 days complete');
      await expect(offer).toHaveCount(0);
    });

    for (const theme of ['light', 'dark'] as const) {
      test(`AU8 axe clean on /login and /signup (${theme})`, async ({ page }) => {
        for (const path of ['/login', '/signup']) {
          await page.goto(path);
          await page.waitForLoadState('networkidle');
          // signed out there is no saved theme: apply it the way BaseLayout does (html[data-theme])
          if (theme === 'dark')
            await page.evaluate(() => {
              document.documentElement.dataset.theme = 'dark';
            });
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          await seriousAxe(page);
          if (theme === 'dark') await shot(page, `${path.slice(1)}-dark`);
        }
      });
    }
  });

  test('AU2 log out → the course dashboard redirects to /login?next=…; the catalogue (/) stays public', async ({ page }) => {
    await page.goto(DASH);
    await expect(dash(page)).toHaveAttribute('data-ready', 'true');
    await openMenu(page);
    await shotEl(menu(page), 'account-menu');
    await seriousAxe(page);
    await menu(page).getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login(\?|$)/);
    expect(await sessionCookie(page)).toBeUndefined();
    await page.goto(DASH);
    await expect(page).toHaveURL(loginUrl(DASH));
    expect((await page.goto('/'))?.status()).toBe(200);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-course="aws-ai-practitioner"]')).toContainText('Sign in to track your progress');
    await page.goto('/mock/1');
    await expect(page).toHaveURL(loginUrl('/mock/1'));
    expect((await page.request.get('/api/me')).status()).toBe(401);
  });

  test('AU5 progress + slide position persist across reload and a new browser context', async ({ page, browser, baseURL, account }) => {
    // progress: mark Day 1 complete in the Full page view
    await page.goto('/day/01');
    const mc = page.locator('[data-mark-complete="1"]');
    await mc.scrollIntoViewIfNeeded();
    await expect(mc).toHaveAttribute('data-ready', 'true');
    await mc.getByRole('button', { name: 'Mark Day 1 complete' }).click();
    await expect(mc).toContainText('Day 1 completed');
    await expect(page.locator('[data-save-status]')).toBeAttached();

    // slide position: Day 2 as slides, move to slide 5
    await putUi(page.request, { lessonView: 'slides' });
    await page.goto('/day/02#slide-4');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: 'Next slide' }).click();
    const article = (p: Page) => p.locator('article[data-lesson-day]');
    await expect(article(page)).toHaveAttribute('data-slide-index', '5');
    await settleSaves(page);
    expect((await getProgress(page.request))?.days['1']?.status).toBe('completed');
    expect((await getUi(page.request))?.slides?.['2']).toBeTruthy();

    await page.goto(DASH);
    await expect(dash(page)).toContainText('1 of 30 days complete');
    await page.reload();
    await expect(dash(page)).toContainText('1 of 30 days complete');
    await page.goto('/day/02');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await expect(article(page)).toHaveAttribute('data-slide-index', '5');

    // another browser: fresh cookies + storage, same learner
    const ctx = await signedInContext(browser, account, { baseURL: baseURL!, viewport: page.viewportSize() });
    const other = await ctx.newPage();
    await other.goto(DASH);
    await expect(dash(other)).toHaveAttribute('data-ready', 'true');
    await expect(dash(other)).toContainText('1 of 30 days complete');
    await other.goto('/day/02');
    await expect(other.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await expect(article(other)).toHaveAttribute('data-slide-index', '5');
    await ctx.close();
  });

  test('CSRF: API writes without X-AIP-Request are refused', async ({ page }) => {
    expect((await page.request.put('/api/ui', { data: { lessonView: 'full' } })).status()).toBe(403);
    expect((await page.request.put('/api/ui', { headers: API_HEADERS, data: { lessonView: 'full' } })).status()).toBe(204);
  });
});
