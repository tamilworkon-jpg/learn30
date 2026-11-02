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

/** Seed the saved theme before any page script runs (BaseLayout applies it on load). */
export const themeInit = (theme: 'light' | 'dark') => {
  const p = {
    schemaVersion: 1,
    examGuideVersion: '1.2',
    startedAt: '2026-10-20T08:00:00.000Z',
    lastPosition: null,
    days: {},
    attempts: [],
    inProgress: {},
    streak: { current: 0, longest: 0 },
    badges: [],
    settings: { theme },
    ratings: {},
  };
  return `if (!localStorage.getItem('aip-course:v1')) localStorage.setItem('aip-course:v1', ${JSON.stringify(JSON.stringify(p))});`;
};
