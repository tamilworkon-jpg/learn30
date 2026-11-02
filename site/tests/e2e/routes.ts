import type { Page } from '@playwright/test';
import { progress, seed } from './progress-fixtures';

// Every learner-facing route (T174–T177). Day pages cover each kind: lesson (01, 02), review (07), mock day (29).
export const ROUTES = [
  { name: 'dashboard', path: '/' },
  { name: 'outline', path: '/outline' },
  { name: 'day-01', path: '/day/01' },
  { name: 'day-02', path: '/day/02' },
  { name: 'day-07-review', path: '/day/07' },
  { name: 'day-29-mock', path: '/day/29' },
  { name: 'mock-1', path: '/mock/1' },
  { name: 'search', path: '/search' },
  { name: 'glossary', path: '/glossary' },
  { name: 'cheatsheet-services', path: '/cheatsheet/services' },
  { name: 'cheatsheet-metrics', path: '/cheatsheet/metrics' },
  { name: 'coverage', path: '/coverage' },
  { name: 'settings', path: '/settings' },
] as const;

/** Save the theme in this test's progress before the first navigation (BaseLayout applies it before paint). */
export const seedTheme = (page: Page, theme: 'light' | 'dark') => seed(page, progress({ settings: { theme } }));
