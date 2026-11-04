// Learn30 site structure (spec 002, contracts/routes.md): the course catalogue is the outer layer (`/`);
// every course page lives under /course/<id>/…. Build every course link with courseHref() — never
// inline '/day/…' strings — so a new course needs no code changes.
export const CATALOGUE_HREF = '/';
export const SETTINGS_HREF = '/settings';
/** The first (and, until more are added, only) course; legacy root URLs redirect into it. */
export const DEFAULT_COURSE_ID = 'aws-ai-practitioner';
/** @deprecated use DEFAULT_COURSE_ID / courseHref (kept while pages migrate). */
export const COURSE_ID = DEFAULT_COURSE_ID;

export type CoursePage = 'dashboard' | 'day' | 'mock' | 'outline' | 'glossary' | 'cheatsheet' | 'coverage' | 'search';

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Link to a page of a course. `arg`: day number (day), mock number (mock) or sheet name (cheatsheet);
 * `hash` without '#'.
 */
export function courseHref(courseId: string, page: CoursePage = 'dashboard', arg?: number | string, hash?: string): string {
  const base = `/course/${courseId}`;
  const h = hash ? `#${hash}` : '';
  switch (page) {
    case 'dashboard':
      return base + h;
    case 'day':
      return `${base}/day/${pad2(Number(arg))}${h}`;
    case 'mock':
      return `${base}/mock/${Number(arg)}${h}`;
    case 'cheatsheet':
      return `${base}/cheatsheet/${arg ?? 'services'}${h}`;
    default:
      return `${base}/${page}${h}`;
  }
}

/** @deprecated use courseHref(id) (kept while pages migrate). */
export const DASHBOARD_HREF = courseHref(DEFAULT_COURSE_ID);

const COURSE_PATH = /^\/course\/([a-z0-9-]+)(?:\/|$)/;

/** The course id of a /course/<id>/… path, or null for global pages (/, /settings, /login, …). */
export function courseIdFromPath(pathname: string): string | null {
  return COURSE_PATH.exec(pathname)?.[1] ?? null;
}

export const isCoursePath = (pathname: string) => courseIdFromPath(pathname) !== null;

/**
 * Pre-Learn30 root URLs of the first course → their new home (301). Returns null when not legacy.
 * /courses → / ; /day/NN, /outline, /mock/N, /glossary, /cheatsheet/*, /coverage, /search → /course/<default>/…
 */
export function legacyCoursePath(pathname: string): string | null {
  if (pathname === '/courses' || pathname === '/courses/') return CATALOGUE_HREF;
  const m = /^\/(day\/\d{2}|mock\/\d+|outline|glossary|coverage|search|cheatsheet\/[a-z-]+)\/?$/.exec(pathname);
  return m ? `/course/${DEFAULT_COURSE_ID}/${m[1]}` : null;
}
