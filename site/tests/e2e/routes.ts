import type { Page } from '@playwright/test';
import { COURSE, DEMO, courseHref } from './fixtures';
import { progress, seed } from './progress-fixtures';

// Every learner-facing route (T174–T177), at its canonical Learn30 path (spec 002 contracts/routes.md; the
// pre-Learn30 root paths still 301 here). Day pages cover each kind: lesson (01, 02), review (07), mock day (29).
// `demo-*` are pages of the test-only fixture course (tests/fixtures/courses/demo-course).
const aws = (page: Parameters<typeof courseHref>[1], arg?: number | string) => courseHref(COURSE, page, arg);
export const ROUTES = [
  { name: 'catalogue', path: '/' },
  { name: 'dashboard', path: aws('dashboard') },
  { name: 'outline', path: aws('outline') },
  { name: 'day-01', path: aws('day', 1) },
  { name: 'day-02', path: aws('day', 2) },
  { name: 'day-07-review', path: aws('day', 7) },
  { name: 'day-29-mock', path: aws('day', 29) },
  { name: 'mock-1', path: aws('mock', 1) },
  { name: 'search', path: aws('search') },
  { name: 'glossary', path: aws('glossary') },
  { name: 'cheatsheet-services', path: aws('cheatsheet', 'services') },
  { name: 'cheatsheet-metrics', path: aws('cheatsheet', 'metrics') },
  { name: 'coverage', path: aws('coverage') },
  { name: 'settings', path: '/settings' },
  { name: 'demo-dashboard', path: courseHref(DEMO) },
  { name: 'demo-day-01', path: courseHref(DEMO, 'day', 1) },
] as const;

/** Save the theme in this test's progress before the first navigation (BaseLayout applies it before paint). */
export const seedTheme = (page: Page, theme: 'light' | 'dark') => seed(page, progress({ settings: { theme } }));
