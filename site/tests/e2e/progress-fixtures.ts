import type { Page } from '@playwright/test';
import type { Attempt, DomainScores, Progress } from '../../src/lib/types';
import { getProgress, putProgress, settleSaves } from './fixtures';

/** Schema-valid progress object for seeding (PUT /api/progress). */
export function progress(over: Partial<Progress> = {}): Progress {
  return {
    schemaVersion: 1,
    examGuideVersion: '1.2',
    startedAt: '2026-10-20T08:00:00.000Z',
    lastPosition: null,
    days: {},
    attempts: [],
    inProgress: {},
    streak: { current: 0, longest: 0 },
    badges: [],
    settings: {},
    ratings: {},
    ...over,
  };
}

export const done = (completedAt = '2026-10-21T09:00:00.000Z') => ({ status: 'completed' as const, sectionsViewed: [], completedAt });

export function attempt(assessmentId: string, byDomain: DomainScores, percent = 60): Attempt {
  return {
    id: `${assessmentId}-seed`,
    assessmentId,
    kind: 'daily',
    startedAt: '2026-10-21T09:00:00.000Z',
    submittedAt: '2026-10-21T09:20:00.000Z',
    answers: {},
    flagged: [],
    score: { correct: 12, total: 20, percent },
    byDomain,
    autoSubmitted: false,
  };
}

/** Saves `p` as this test's server-side progress (PUT /api/progress). Call before `page.goto` — the server
 *  embeds the saved progress in every page (bootstrap), and later reloads keep whatever the app saved. */
export async function seed(page: Page, p: Progress) {
  await putProgress(page.request, p);
}

/** The progress the server holds for this test's user, after the page's pending (debounced) saves completed. */
export async function readProgress(page: Page): Promise<Progress | null> {
  await settleSaves(page);
  return getProgress(page.request);
}

/** Change the saved progress "behind the app's back" and reopen the current page: leaves the page first (so
 *  its pagehide flush cannot overwrite the edit), edits the server copy, then navigates back. */
export async function editProgress(page: Page, edit: (p: Progress) => void) {
  const url = page.url();
  await page.goto('about:blank');
  await settleSaves(page);
  const p = (await getProgress(page.request))!;
  edit(p);
  await putProgress(page.request, p);
  await page.goto(url);
}
