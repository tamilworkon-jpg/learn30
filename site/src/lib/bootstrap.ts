// T189 — per-page bootstrap written by the Node server immediately before </head> (contract §5; Learn30:
// spec 002 progress-api-v2): {"user","ui","course":{"id","progress"}|null,"summary"|null,"progress"}.
// `progress` = the page's course (first course on global pages), kept for older readers.
// Never executed (CSP-safe); read once per page. Missing / unreadable → signed out.
import type { Progress } from './types';

export interface User {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
  /** Admins see the admin console (/admin). */
  isAdmin?: boolean;
}

/** Server-wide facts, present on signed-out pages too. */
export interface SiteInfo {
  /** Anyone may create an account (false: only admins create accounts). */
  signup: boolean;
}

export interface UiState {
  /** Learn30: the theme is an account-wide UI setting (was progress.settings.theme). */
  theme?: 'light' | 'dark';
  lessonView?: 'slides' | 'full';
  sidebar?: 'expanded' | 'collapsed';
  sections?: 'expanded' | 'collapsed';
  /** Keyed `<courseId>:<day>` (a bare day = a pre-Learn30 key of the first course). */
  slides?: Record<string, { sectionId: string; block: number }>;
}

export interface CourseSummary {
  completed: number;
  startedAt: string | null;
  lastPosition: { day: number; sectionId: string; updatedAt: string } | null;
  updatedAt: string;
}

export interface Bootstrap {
  user: User | null;
  progress: Progress | null;
  ui: UiState | null;
  /** Set on /course/<id>/… pages. */
  course: { id: string; progress: Progress | null } | null;
  /** Per-course summary on global pages (catalogue, settings). */
  summary: { courses: Record<string, CourseSummary> } | null;
  site?: SiteInfo;
}

export const BOOTSTRAP_ID = 'aip-bootstrap';
const SIGNED_OUT: Bootstrap = { user: null, progress: null, ui: null, course: null, summary: null };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isUser = (u: unknown): u is User => isObj(u) && typeof u.id === 'number' && typeof u.username === 'string' && typeof u.displayName === 'string';

export function parseBootstrap(doc: Document = document): Bootstrap {
  const el = doc.getElementById(BOOTSTRAP_ID);
  if (!el || el.getAttribute('type') !== 'application/json') return { ...SIGNED_OUT };
  try {
    const data = JSON.parse(el.textContent ?? '') as unknown;
    if (!isObj(data)) return { ...SIGNED_OUT };
    const site = isObj(data.site) && typeof data.site.signup === 'boolean' ? { signup: data.site.signup } : undefined;
    if (!isUser(data.user)) return { ...SIGNED_OUT, ...(site ? { site } : {}) };
    return {
      site,
      user: data.user,
      progress: isObj(data.progress) ? (data.progress as unknown as Progress) : null,
      ui: isObj(data.ui) ? (data.ui as UiState) : null,
      course:
        isObj(data.course) && typeof data.course.id === 'string'
          ? { id: data.course.id, progress: isObj(data.course.progress) ? (data.course.progress as unknown as Progress) : null }
          : null,
      summary: isObj(data.summary) && isObj(data.summary.courses) ? (data.summary as Bootstrap['summary']) : null,
    };
  } catch {
    return { ...SIGNED_OUT };
  }
}

let cached: Bootstrap | null = null;
/** The page's bootstrap (parsed once). Outside a browser → signed out. */
export function getBootstrap(): Bootstrap {
  if (typeof document === 'undefined') return { ...SIGNED_OUT };
  return (cached ??= parseBootstrap(document));
}
export const currentUser = () => getBootstrap().user;
export const isSignedIn = () => currentUser() !== null;
export const isAdmin = () => currentUser()?.isAdmin === true;
/** Public sign-up is open unless the server says otherwise (pages without a bootstrap, e.g. stro dev, keep it). */
export const signupOpen = () => getBootstrap().site?.signup !== false;

/** Test hook: forget the cached bootstrap. */
export function resetBootstrapCache() {
  cached = null;
}
