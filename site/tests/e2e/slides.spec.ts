import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { noHorizontalScroll, shotEl, trackConsole } from './helpers';
import { readProgress } from './progress-fixtures';
import { themeInit } from './routes';

// T182 — slide lessons (SL1–SL8). The other specs open lessons in the Full page view (playwright.config
// storageState); here the browser starts clean, so lessons open in the default slide view.
test.use({ storageState: { cookies: [], origins: [] } });

const VIEW_KEY = 'aip-ui:lesson-view';

/** What the learner sees: a viewport screenshot (a full-page capture would resize the viewport and re-page). */
async function viewShot(page: Page, name: string) {
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `tests/e2e/__screenshots__/review/${name}-${test.info().project.name}.png` });
}
const article = (page: Page) => page.locator('article[data-lesson-day]');
const next = (page: Page) => page.getByRole('button', { name: 'Next slide' });
const prev = (page: Page) => page.getByRole('button', { name: 'Previous slide' });

async function openDeck(page: Page, path = '/day/02') {
  await page.goto(path);
  await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-lesson-view', 'slides');
}
const slideNo = async (page: Page) => Number(await article(page).getAttribute('data-slide-index'));
const total = async (page: Page) => Number((await page.locator('.deck-count').textContent())!.match(/of (\d+)/)![1]);

async function seriousAxe(page: Page) {
  const r = await new AxeBuilder({ page }).analyze();
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`)).toEqual([]);
}

/** Facts about the slide on screen, measured in the page. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const a = document.querySelector<HTMLElement>('article[data-lesson-day]')!;
    const shown = (e: Element) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';
    const visual = [...a.querySelectorAll('img, svg, figure, table, .console')].some(shown);
    const nav = document.querySelector<HTMLElement>('.sidebar')!;
    const bottomBar = getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().height : 0;
    const bar = document.querySelector('.deck-bar')!.getBoundingClientRect();
    const ctl = document.querySelector('.deck-controls')!.getBoundingClientRect();
    const p = [...a.querySelectorAll('p, li')].find((e) => shown(e) && !e.closest('.callout, .lab-banner, .quiz, figure, .console, .chip, table, [class*="text-sm"]'));
    // Bottom of the lowest visible content inside the stage, in viewport coordinates.
    const contentBottom = Math.max(...[...a.querySelectorAll('*')].filter((e) => e.getClientRects().length > 0).map((e) => e.getBoundingClientRect().bottom));
    return {
      contentBottom,
      contentTop: a.getBoundingClientRect().top,
      scrollY: window.scrollY,
      navTop: ctl.top,
      noticeShown: !!document.querySelector('#skip-notice:not([hidden])'),
      interactive: a.classList.contains('slide-scroll'),
      quiz: !!a.querySelector('.quiz-slot')?.getClientRects().length,
      overflow: a.scrollHeight - a.clientHeight,
      visual,
      deckTop: bar.top,
      deckBottom: ctl.bottom,
      viewport: innerHeight - bottomBar,
      font: p ? parseFloat(getComputedStyle(p).fontSize) : null,
    };
  });

test.describe('slide lessons (T182) @visual', () => {
  // Real screens: short, wide CSS viewports (125–150 % display scaling, browser chrome) as well as phones.
  const VIEWPORTS = {
    desktop: [
      { width: 1280, height: 600 },
      { width: 1366, height: 650 },
      { width: 1536, height: 730 },
      { width: 1920, height: 900 },
      { width: 1280, height: 800 },
    ],
    // Phones: not in scope for this round (learner feedback is about desktop windows); the default phone size stays covered.
    mobile: [{ width: 375, height: 812 }],
  };
  for (const [project, sizes] of Object.entries(VIEWPORTS)) {
    for (const vp of sizes) {
      for (const path of ['/day/02', '/day/15']) {
        test(`SL1 SL3 SL4 ${path} @ ${vp.width}×${vp.height}: every slide fits above the controls without page scroll`, async ({ page }, info) => {
          test.skip(info.project.name !== project, `${project} viewport`);
          const problems = trackConsole(page);
          await page.setViewportSize(vp);
          await openDeck(page, path);
          await page.waitForLoadState('networkidle');
          const n = await total(page);
          expect(n).toBeGreaterThanOrEqual(11);
          await expect(page.locator('.deck-count')).toHaveText(`Slide 1 of ${n}`);
          await expect(prev(page)).toBeDisabled();
          // fresh learner: the skip-ahead notice is shown (inside the deck) on slide 1
          await expect(page.locator('#skip-notice')).toBeVisible();
          if (path === '/day/02' && vp.width === 1280 && vp.height === 800) await viewShot(page, 'slide-first');
          if (path === '/day/02' && vp.width === 375 && vp.height === 812) await viewShot(page, 'slide-first');
          if (path === '/day/02' && vp.width === 1366) await viewShot(page, 'slide-short-viewport');
          const minFont = project === 'mobile' ? 18 : 20;
          for (let i = 1; i <= n; i++) {
            if (i > 1) await next(page).click();
            expect(await total(page), 'slide count stays stable').toBe(n);
            expect(await slideNo(page)).toBe(i);
            const m = await measure(page);
            const where = `${path} @${vp.width}×${vp.height} slide ${i} (${await article(page).getAttribute('data-slide-section')})`;
            if (i === 1) expect(m.noticeShown, 'notice visible on slide 1').toBe(true);
            expect(m.visual, `${where} has a visual`).toBe(true);
            // No page scroll needed — on first load and after navigating: title bar, slide and controls all on screen …
            expect(m.scrollY, `${where} page not scrolled`).toBe(0);
            expect(m.deckTop, where).toBeGreaterThanOrEqual(0);
            expect(m.contentTop, where).toBeGreaterThanOrEqual(0);
            expect(m.deckBottom, where).toBeLessThanOrEqual(m.viewport + 1);
            // … and nothing of a reading slide is hidden under the controls or clipped (no inner scroll).
            // Only the quiz slide may scroll inside the stage (one question at a time, but results grow).
            if (!m.quiz) {
              expect(m.contentBottom, `${where} content ends above the controls`).toBeLessThanOrEqual(m.navTop + 0.5);
              expect(m.overflow, `${where} fits without inner scroll`).toBeLessThanOrEqual(0);
              if (m.font !== null) expect(m.font, `${where} body font`).toBeGreaterThanOrEqual(minFont);
            }
          }
          await expect(next(page)).toBeDisabled();
          // and back again with the keyboard / a deep link
          await page.keyboard.press('ArrowLeft');
          const back = await measure(page);
          expect(back.deckBottom).toBeLessThanOrEqual(back.viewport + 1);
          await page.goto(`${path}#slide-3`);
          await expect.poll(() => slideNo(page)).toBe(3);
          const deep = await measure(page);
          expect(deep.contentBottom).toBeLessThanOrEqual(deep.navTop + 0.5);
          expect(deep.deckBottom).toBeLessThanOrEqual(deep.viewport + 1);
          await noHorizontalScroll(page);
          expect(problems, problems.join('\n')).toEqual([]);
        });
      }
    }
  }

  test('SL2 buttons, arrow/page keys, swipe, #slide-n deep links, focus + announcement', async ({ page }) => {
    await page.goto('/day/02#slide-5');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await page.waitForLoadState('networkidle');
    expect(await slideNo(page)).toBe(5);
    await expect(page.locator('.deck-count')).toContainText('Slide 5 of');

    await next(page).click();
    expect(await slideNo(page)).toBe(6);
    await expect(page).toHaveURL(/#slide-6$/);
    // focus moves to the slide heading and the change is announced
    expect(await page.evaluate(() => document.activeElement?.matches('.sec-head, summary, h2'))).toBe(true);
    await expect(page.locator('.deck-live')).toContainText('Slide 6 of');
    await prev(page).click();
    expect(await slideNo(page)).toBe(5);

    await page.keyboard.press('ArrowRight');
    expect(await slideNo(page)).toBe(6);
    await page.keyboard.press('PageDown');
    expect(await slideNo(page)).toBe(7);
    await page.keyboard.press('ArrowLeft');
    expect(await slideNo(page)).toBe(6);
    await page.keyboard.press('PageUp');
    expect(await slideNo(page)).toBe(5);

    // swipe left → next, swipe right → previous
    const swipe = (dx: number) =>
      article(page).evaluate((el, d) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        const t = (cx: number) => new Touch({ identifier: 1, target: el, clientX: cx, clientY: y });
        el.dispatchEvent(new TouchEvent('touchstart', { touches: [t(x)], changedTouches: [t(x)], bubbles: true }));
        el.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(x + d)], bubbles: true }));
      }, dx);
    await swipe(-150);
    expect(await slideNo(page)).toBe(6);
    await swipe(150);
    expect(await slideNo(page)).toBe(5);

    // a section link (resume / section nav) opens that section's first slide
    await page.goto('/day/02#examples');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await expect(article(page)).toHaveAttribute('data-slide-section', 'examples');
    await expect(page.locator('#examples')).toBeVisible();
    await expect(page.locator('#explanation')).toBeHidden();
  });

  test('section nav jumps to a section and shows the current one; deep dive expands; quiz works', async ({ page, isMobile }, info) => {
    const problems = trackConsole(page);
    await openDeck(page);
    const nav = page.getByRole('navigation', { name: "Today's sections" });
    if (isMobile || info.project.name === 'mobile') await nav.locator('summary').click();
    await nav.locator('[data-nav-for="hands-on"]').click();
    await expect(article(page)).toHaveAttribute('data-slide-section', 'hands-on');
    await expect(nav.locator('[data-nav-for="hands-on"]')).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('#hands-on')).toBeVisible();
    await expect(page.locator('#hands-on h2')).toBeInViewport();
    // a lab-step slide: the console mock-up is the slide's visual
    while (!(await page.locator('#hands-on .lab-step').first().isVisible())) await next(page).click();
    await expect(page.locator('#hands-on .lab-step .console').first()).toBeVisible();
    await viewShot(page, 'slide-lab');

    await page.goto('/day/02#diagram');
    await expect(article(page)).toHaveAttribute('data-slide-section', 'diagram');
    const img = page.locator('#diagram figure.diagram img').first();
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
    await expect.poll(async () => (await measure(page)).overflow).toBeLessThanOrEqual(0);
    await viewShot(page, 'slide-diagram');

    // the optional deep dive: a collapsed teaser slide that expands into its own slides
    await page.goto('/day/02#deep-dive');
    const deep = page.locator('details.deep-dive');
    await expect(deep).not.toHaveAttribute('open', '');
    await expect(deep.locator('summary')).toContainText('Optional');
    const before = await total(page);
    await deep.locator('summary').click();
    await expect(deep).toHaveAttribute('open', '');
    await expect.poll(() => total(page)).toBeGreaterThan(before);
    await expect(article(page)).toHaveAttribute('data-slide-section', 'deep-dive');
    while (!(await deep.locator('figure.diagram').isVisible())) await next(page).click();
    expect((await measure(page)).overflow).toBeLessThanOrEqual(0);

    // the quiz slide keeps the QuizRunner working
    await page.goto('/day/02#quiz');
    const quiz = page.locator('[data-quiz="day-02"]');
    await expect(quiz).toHaveAttribute('data-ready', 'true');
    await quiz.locator('label.opt').first().click();
    await expect(quiz).toContainText(/1 \/ \d+ answered/);
    await quiz.getByRole('button', { name: /^Next →/ }).click();
    await expect(quiz).toContainText(/Question 2 of/);
    await expect(article(page)).toHaveAttribute('data-slide-section', 'quiz'); // quiz buttons don't change slides
    expect(problems, problems.join('\n')).toEqual([]);
  });

  test('SL5 key terms are highlighted and callouts get a Key point treatment', async ({ page }, info) => {
    await page.goto('/day/02#explanation');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    const strong = page.locator('#explanation :is(p, li, .slide-sent) > strong:visible').first();
    for (let i = 0; i < 10 && !(await strong.count()); i++) await page.keyboard.press('ArrowRight');
    await expect(strong).toBeVisible();
    expect(await strong.evaluate((e) => getComputedStyle(e).backgroundImage)).toContain('linear-gradient');
    await page.goto('/day/02#exam-tips');
    const callout = page.locator('#exam-tips .callout-examTrap');
    await expect(callout).toBeVisible();
    await expect(callout).toHaveClass(/slide-keypoint/);
    expect(await callout.evaluate((e) => getComputedStyle(e, '::before').content)).toContain('Key point');
    // component internals are not highlighted: Day 1 exam-fact numbers, chips, the console mock-up
    await page.goto('/day/01#orientation');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    for (let i = 0; i < 6 && !(await page.locator('#orientation .fact strong').first().isVisible()); i++) await page.keyboard.press('ArrowRight');
    await expect(page.locator('#orientation .fact strong').first()).toBeVisible();
    for (const bg of await page.locator('#orientation .fact strong').evaluateAll((els) => els.map((e) => getComputedStyle(e).backgroundImage))) expect(bg).toBe('none');
    // explanation slides with ≥ 3 bold terms show the "Key terms on this slide" strip when it fits
    // (on a phone the slides are full, so the optional strip rarely has room)
    if (info.project.name === 'mobile') return;
    await page.goto('/day/02#explanation');
    await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
    await page.waitForLoadState('networkidle');
    let found = false;
    for (let i = 0; i < 30 && !found; i++) {
      found = await page.locator('.key-strip:not([hidden])').isVisible();
      if (!found) await page.keyboard.press('ArrowRight');
    }
    expect(found).toBe(true);
    await expect(page.locator('.key-strip .key-term').first()).toBeVisible();
    expect((await measure(page)).overflow).toBeLessThanOrEqual(0);
  });

  test('SL6 Full page toggle restores the long page and persists across reloads; print shows everything', async ({ page }) => {
    await openDeck(page);
    await expect(page.locator('#examples')).toBeHidden();
    const toggle = page.getByRole('group', { name: 'Lesson view' });
    await toggle.getByRole('button', { name: 'Full page' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-lesson-view', 'full');
    await expect(toggle.getByRole('button', { name: 'Full page' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#examples')).toBeVisible();
    await expect(page.locator('#summary')).toBeVisible();
    await expect(next(page)).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), VIEW_KEY)).toBe('full');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('aip-course:v1') ?? '{}').settings?.lessonView)).toBeUndefined();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-lesson-view', 'full');
    await expect(page.locator('#examples')).toBeVisible();

    await toggle.getByRole('button', { name: 'Slides' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-lesson-view', 'slides');
    await expect(page.locator('#examples')).toBeHidden();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-lesson-view', 'slides');

    await page.emulateMedia({ media: 'print' });
    for (const id of ['recap', 'explanation', 'examples', 'summary']) await expect(page.locator(`#${id}`)).toBeVisible();
    await expect(next(page)).toBeHidden();
    await page.emulateMedia({ media: 'screen' });

    // search indexing: the built page still contains the whole lesson
    const html = await (await page.request.get('/day/02')).text();
    expect(html).toContain('data-pagefind-body');
    expect(html).toContain('Worked example — choosing hyperparameters fairly');
  });

  test('SL7 the section tracker marks sections viewed in slide mode', async ({ page }) => {
    await page.goto('/day/02#examples');
    await expect(article(page)).toHaveAttribute('data-slide-section', 'examples');
    await expect.poll(async () => (await readProgress(page))?.days['2']?.sectionsViewed ?? [], { timeout: 10_000 }).toContain('examples');
    expect((await readProgress(page))?.lastPosition?.sectionId).toBe('examples');
    await page.keyboard.press('ArrowRight');
    await page.goto('/day/02#summary');
    await expect.poll(async () => (await readProgress(page))?.days['2']?.sectionsViewed ?? [], { timeout: 10_000 }).toContain('summary');
    expect((await readProgress(page))?.days['2']?.sectionsViewed).not.toContain('deep-dive');
  });

  for (const theme of ['light', 'dark'] as const) {
    test(`SL8 axe clean + visible keyboard focus (${theme})`, async ({ page }, info) => {
      await page.addInitScript(themeInit(theme));
      await openDeck(page);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.waitForLoadState('networkidle');
      await seriousAxe(page);
      await next(page).focus();
      await page.keyboard.press('Enter'); // keyboard activation; focus moves to the heading
      expect(await slideNo(page)).toBe(2);
      await next(page).focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const outline = await next(page).evaluate((e) => getComputedStyle(e).outlineStyle);
      expect(outline).not.toBe('none');
      await page.goto('/day/02#exam-tips');
      await expect(page.locator('#exam-tips .callout-examTrap')).toBeVisible();
      await seriousAxe(page);
      if (theme === 'dark') {
        await page.goto('/day/02');
        await expect(page.locator('html')).toHaveAttribute('data-deck-ready', 'true');
        await viewShot(page, 'slide-first-dark');
        await page.goto('/day/02#hands-on');
        while (!(await page.locator('#hands-on .lab-step').first().isVisible())) await next(page).click();
        await viewShot(page, 'slide-lab-dark');
      }
      if (info.project.name === 'mobile' && theme === 'light') {
        await page.goto('/day/02#explanation');
        await expect(page.locator('#explanation')).toBeVisible();
        await page.waitForLoadState('networkidle');
        await shotEl(page.locator('.slide-deck'), 'slide-mobile');
      }
    });
  }
});
