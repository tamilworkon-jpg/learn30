import { test as base, expect, type APIRequestContext, type Browser, type BrowserContext, type Page, type Request } from '@playwright/test';
import type { Progress } from '../../src/lib/types';

// Phase 13 (contracts/server-api.md §8): every test runs against the Node server with a fresh, random account,
// so tests are isolated under parallel workers. `page.request` shares the browser context's cookie jar, so the
// session cookie set by sign-up is used by the page's navigations too.

export type LessonView = 'full' | 'slides' | null;
export interface UiState {
  lessonView?: 'slides' | 'full';
  sidebar?: 'expanded' | 'collapsed';
  sections?: 'expanded' | 'collapsed';
  slides?: Record<string, { sectionId: string; block: number }>;
}
export interface Account {
  username: string;
  password: string;
  displayName: string;
}

/** CSRF header required on every non-GET /api/* request (contract §3). */
export const API_HEADERS = { 'X-AIP-Request': '1' } as const;
/** Client save debounce (contract §7, ≈ 400 ms) plus a margin. */
const SAVE_SETTLE_MS = 550;

let seq = 0;
/** A unique, contract-valid username (3–30 chars, [a-z0-9_.-]) per call, across workers and runs. */
export function newAccount(displayName = 'Test Learner'): Account {
  const id = `${Date.now().toString(36)}${process.pid.toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { username: `e2e_${id}`.slice(0, 30), password: 'correct-horse-battery-9', displayName };
}

export async function signUp(request: APIRequestContext, a: Account) {
  const r = await request.post('/api/auth/signup', { headers: API_HEADERS, data: { username: a.username, password: a.password, displayName: a.displayName } });
  expect(r.status(), `sign-up ${a.username}: ${await r.text()}`).toBe(201);
}

export async function logIn(request: APIRequestContext, a: Account) {
  const r = await request.post('/api/auth/login', { headers: API_HEADERS, data: { username: a.username, password: a.password } });
  expect(r.status(), `log-in ${a.username}: ${await r.text()}`).toBe(200);
}

export async function putUi(request: APIRequestContext, ui: UiState) {
  const r = await request.put('/api/ui', { headers: API_HEADERS, data: ui });
  expect(r.status(), `PUT /api/ui: ${await r.text()}`).toBe(204);
}

export async function getUi(request: APIRequestContext): Promise<UiState | null> {
  const r = await request.get('/api/ui');
  return r.status() === 200 ? ((await r.json()) as UiState) : null;
}

export async function putProgress(request: APIRequestContext, p: Progress) {
  const r = await request.put('/api/progress', { headers: API_HEADERS, data: p });
  expect(r.status(), `PUT /api/progress: ${await r.text()}`).toBe(204);
}

export async function getProgress(request: APIRequestContext): Promise<Progress | null> {
  const r = await request.get('/api/progress');
  return r.status() === 200 ? ((await r.json()) as Progress) : null;
}

/** A second, independent browser context (own cookies + storage) logged in as `a` — "another browser". */
export async function signedInContext(browser: Browser, a: Account, opts: { baseURL: string; viewport?: { width: number; height: number } | null }): Promise<BrowserContext> {
  const ctx = await browser.newContext({ baseURL: opts.baseURL, viewport: opts.viewport ?? undefined });
  await logIn(ctx.request, a);
  return ctx;
}

// In-flight client saves (PUT /api/progress | /api/ui) per page, so readers can wait for the debounced save.
const pending = new WeakMap<Page, Set<Request>>();
const isSave = (r: Request) => r.method() === 'PUT' && /\/api\/(progress|ui)$/.test(new URL(r.url()).pathname);
export function trackSaves(page: Page) {
  if (pending.has(page)) return;
  const set = new Set<Request>();
  pending.set(page, set);
  page.on('request', (r) => isSave(r) && set.add(r));
  page.on('requestfinished', (r) => set.delete(r));
  page.on('requestfailed', (r) => set.delete(r));
}

/** Wait until the page's debounced saves have fired and completed. */
export async function settleSaves(page: Page) {
  await page.waitForTimeout(SAVE_SETTLE_MS);
  const set = pending.get(page);
  if (set) await expect.poll(() => set.size, { message: 'client saves finish', timeout: 10_000 }).toBe(0);
}

type Options = { signedIn: boolean; lessonView: LessonView };
type Fixtures = { account: Account; session: void };

export const test = base.extend<Options & Fixtures>({
  /** false → the test starts signed out (`test.use({ signedIn: false })`). */
  signedIn: [true, { option: true }],
  /** Lesson view saved in the account's UiState before the test: 'full' (existing specs), 'slides', or null (server default). */
  lessonView: ['full', { option: true }],
  /** This test's account; registered by the auto fixture unless signedIn is false (then the test may sign up with it). */
  // eslint-disable-next-line no-empty-pattern
  account: async ({}, use) => {
    await use(newAccount());
  },
  session: [
    async ({ page, signedIn, lessonView, account }, use) => {
      trackSaves(page);
      if (signedIn) {
        await signUp(page.request, account);
        // Test accounts choose "Today's sections" expanded: the desktop project is 1280 px wide, where a learner
        // with no choice gets it collapsed (narrow-window default, covered by tests/unit/before-paint.test.ts).
        await putUi(page.request, lessonView ? { lessonView, sections: 'expanded' } : { sections: 'expanded' });
      }
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Browser, BrowserContext, Locator, Page } from '@playwright/test';
