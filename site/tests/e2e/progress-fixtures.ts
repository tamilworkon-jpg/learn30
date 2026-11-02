import type { Page } from '@playwright/test';
import type { Attempt, DomainScores, Progress } from '../../src/lib/types';

/** Schema-valid progress object for seeding localStorage. */
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

/** Seeds localStorage once per test (later reloads keep whatever the app wrote). */
export async function seed(page: Page, p: Progress) {
  await page.addInitScript((json) => {
    if (sessionStorage.getItem('e2e-seeded')) return;
    localStorage.setItem('aip-course:v1', json);
    sessionStorage.setItem('e2e-seeded', '1');
  }, JSON.stringify(p));
}

export const readProgress = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('aip-course:v1') ?? 'null') as Progress | null);
