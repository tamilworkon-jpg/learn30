import { EXAM_GUIDE_VERSION } from '../constants';
import { localDate, recordStudyDay } from '../streak';
import type { Attempt, Progress } from '../types';
import validateProgress from '../../schemas/generated/validate-progress';

import { createSync, takeHandoff, type Sync } from '../api';
import { getBootstrap } from '../bootstrap';
import { currentCourseId } from '../current-course';
import { DEFAULT_COURSE_ID } from '../routes';
import { getUiState } from '../ui-state';
import { reportSaveStatus } from '../save-status';
import { STORAGE_KEY } from './keys';

export { STORAGE_KEY };
const MAX_ATTEMPTS = 500;

export function defaultProgress(): Progress {
  return {
    schemaVersion: 1,
    examGuideVersion: EXAM_GUIDE_VERSION,
    startedAt: new Date().toISOString(),
    lastPosition: null,
    days: {},
    attempts: [],
    inProgress: {},
    streak: { current: 0, longest: 0 },
    badges: [],
    settings: {},
    ratings: {},
  };
}

export type NewAttempt = Omit<Attempt, 'id' | 'submittedAt'> & { id?: string; submittedAt?: string };
type Listener = (p: Progress) => void;

// Fields optional in the schema (older exports) get defaults so mutations never hit undefined.
function normalize(p: Progress): Progress {
  return { ...p, lastPosition: p.lastPosition ?? null, ratings: p.ratings ?? {}, settings: p.settings ?? {} };
}

/** localStorage can be missing, blocked (privacy modes) or full: fall back to memory instead of crashing. */
function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

interface CoreOptions {
  initial: Progress;
  persist: (p: Progress) => void;
  persistent: () => boolean;
  recovered: boolean;
  signedIn: boolean;
}

/** The synchronous store API shared by every backend (localStorage for tests, server sync, memory). */
function createCore({ initial, persist, persistent, recovered, signedIn }: CoreOptions) {
  let state = normalize(initial);
  const listeners = new Set<Listener>();

  const save = () => {
    persist(state);
    listeners.forEach((l) => l(state));
  };
  const day = (n: number) => (state.days[String(n)] ??= { status: 'not-started', sectionsViewed: [] });
  const dayOf = (assessmentId: string) => {
    const m = /^day-(\d{2})$/.exec(assessmentId);
    return m ? Number(m[1]) : null;
  };

  return {
    get recovered() {
      return recovered;
    },
    /** false when progress isn't saved anywhere (signed out, or storage blocked/full) — UI may warn the learner. */
    get persistent() {
      return persistent();
    },
    /** true when progress is saved to the learner's account on the server. */
    signedIn,
    get: () => state,
    subscribe(l: Listener) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    setLastPosition(n: number, sectionId: string) {
      state.lastPosition = { day: n, sectionId, updatedAt: new Date().toISOString() };
      save();
    },
    markSectionViewed(n: number, sectionId: string) {
      const d = day(n);
      if (!d.sectionsViewed.includes(sectionId)) d.sectionsViewed.push(sectionId);
      if (d.status === 'not-started') d.status = 'in-progress';
      save();
    },
    markDayComplete(n: number) {
      const d = day(n);
      d.status = 'completed';
      d.completedAt = new Date().toISOString();
      state.streak = recordStudyDay(state.streak, localDate());
      save();
    },
    unmarkDay(n: number) {
      const d = day(n);
      d.status = 'in-progress';
      delete d.completedAt;
      save();
    },
    saveInProgress(assessmentId: string, data: { answers: Progress['inProgress'][string]['answers']; flagged: string[]; deadline?: string; checked?: string[]; index?: number }) {
      const prev = state.inProgress[assessmentId];
      state.inProgress[assessmentId] = { ...data, startedAt: prev?.startedAt ?? new Date().toISOString() };
      save();
    },
    recordAttempt(a: NewAttempt): Attempt {
      const attempt: Attempt = {
        ...a,
        id: a.id ?? `${a.assessmentId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        submittedAt: a.submittedAt ?? new Date().toISOString(),
      };
      state.attempts.push(attempt);
      if (state.attempts.length > MAX_ATTEMPTS) state.attempts.splice(0, state.attempts.length - MAX_ATTEMPTS);
      delete state.inProgress[a.assessmentId];
      const n = dayOf(a.assessmentId);
      if (n) {
        const d = day(n);
        d.latestScore = a.score.percent;
        d.bestScore = Math.max(d.bestScore ?? 0, a.score.percent);
        if (d.status === 'not-started') d.status = 'in-progress';
      }
      save();
      return attempt;
    },
    awardBadges(ids: string[]) {
      const add = ids.filter((id) => !state.badges.includes(id));
      if (!add.length) return;
      state.badges = [...state.badges, ...add];
      save();
    },
    setRating(week: string, value: number) {
      if (!/^week-[1-4]$/.test(week) || !Number.isInteger(value) || value < 1 || value > 5) throw new Error('Invalid rating');
      state.ratings[week] = value;
      save();
    },
    /** T183 — the course start date (local calendar day) drives every planned date. */
    setStartDate(date: Date) {
      if (Number.isNaN(date.getTime())) throw new Error('Invalid start date');
      state.startedAt = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      save();
    },
    /** Learn30: the theme is account-wide (UiState); kept on progress too for older readers/exports. */
    setTheme(theme: 'light' | 'dark') {
      state.settings.theme = theme;
      if (signedIn) getUiState().setTheme(theme);
      save();
    },
    replace(next: Progress) {
      state = normalize(next);
      save();
    },
    reset() {
      state = defaultProgress();
      save();
    },
  };
}

export type Store = ReturnType<typeof createCore>;

/** localStorage-backed store (unit tests, and the legacy-import reader). */
export function createStore(storage: Storage | null = browserStorage(), key: string = STORAGE_KEY): Store {
  let persistent = storage !== null;
  const read = (k: string) => {
    try {
      return storage?.getItem(k) ?? null;
    } catch {
      persistent = false;
      return null;
    }
  };
  const write = (k: string, value: string) => {
    if (!storage) return;
    try {
      storage.setItem(k, value);
      persistent = true;
    } catch {
      persistent = false; // quota exceeded / blocked: keep working in memory for this session
    }
  };
  const raw = read(key);
  let initial: Progress;
  let recovered = false;
  try {
    const parsed = raw ? JSON.parse(raw) : defaultProgress();
    if (!validateProgress(parsed)) throw new Error('invalid');
    initial = parsed as Progress;
  } catch {
    recovered = raw !== null;
    // Keep the FIRST unreadable copy: a later recovery must not overwrite the original backup.
    if (raw !== null && read(`${key}:backup`) === null) write(`${key}:backup`, raw);
    initial = defaultProgress();
  }
  return createCore({ initial, persist: (p) => write(key, JSON.stringify(p)), persistent: () => persistent, recovered, signedIn: false });
}

/** Signed out: lessons and quizzes work, nothing is written anywhere (contract §6). */
export function createMemoryStore(initial: Progress = defaultProgress()): Store {
  return createCore({ initial, persist: () => {}, persistent: () => false, recovered: false, signedIn: false });
}

export interface SyncedStore {
  store: Store;
  sync: Sync;
}

/**
 * Signed in (T189): state starts from the page bootstrap's progress; every change is sent as ONE
 * debounced PUT /api/progress (flushed with keepalive on pagehide by getStore()).
 */
export function createSyncedStore(
  bootstrapped: unknown,
  opts: { fetchImpl?: typeof fetch; delay?: number; handoff?: { storage: Storage | null; key: string }; courseId?: string; theme?: 'light' | 'dark' } = {},
): SyncedStore {
  // A newer copy flushed by the previous page in this tab wins over a bootstrap that may predate it.
  const handed = opts.handoff ? takeHandoff(opts.handoff.storage, opts.handoff.key) : null;
  const adopt = handed !== null && validateProgress(handed);
  if (adopt) bootstrapped = handed;
  const valid = bootstrapped !== null && bootstrapped !== undefined && validateProgress(bootstrapped);
  let store: Store | null = null;
  const sync = createSync({
    url: `/api/courses/${opts.courseId ?? DEFAULT_COURSE_ID}/progress`,
    body: () => store!.get(),
    delay: opts.delay,
    fetchImpl: opts.fetchImpl,
    onStatus: (s) => reportSaveStatus('progress', s),
    handoff: opts.handoff,
  });
  const initial = valid ? (bootstrapped as Progress) : defaultProgress();
  // The account-wide theme (UiState) wins over a theme saved inside an older progress document.
  if (opts.theme) initial.settings = { ...(initial.settings ?? {}), theme: opts.theme };
  store = createCore({
    initial,
    persist: () => sync.schedule(),
    persistent: () => true,
    recovered: !valid && bootstrapped !== null && bootstrapped !== undefined,
    signedIn: true,
  });
  if (adopt) sync.schedule(); // make sure the server ends up with it
  return { store, sync };
}

function sessionStore(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

export { currentCourseId };

const stores = new Map<string, Store>();

/** The progress the page bootstrap carries for `courseId`, or undefined when it doesn't have it. */
function bootstrappedProgress(courseId: string): unknown {
  const boot = getBootstrap();
  if (boot.course) return boot.course.id === courseId ? boot.course.progress : undefined;
  // Global page: `progress` is the first course's (spec 002 progress-api-v2).
  return courseId === DEFAULT_COURSE_ID ? boot.progress : undefined;
}

function syncedFor(courseId: string, progress: unknown): Store {
  const boot = getBootstrap();
  const { store, sync } = createSyncedStore(progress, {
    courseId,
    theme: boot.ui?.theme,
    handoff: { storage: sessionStore(), key: `aip-handoff:progress:${boot.user!.id}:${courseId}` },
  });
  if (typeof window !== 'undefined') window.addEventListener('pagehide', () => sync.flush());
  stores.set(courseId, store);
  return store;
}

/**
 * A course's store (default: this page's course): the signed-in learner's server-synced progress, or
 * memory only when signed out. Progress the page doesn't carry must be loaded with loadStore().
 */
export function getStore(courseId: string = currentCourseId()): Store {
  const have = stores.get(courseId);
  if (have) return have;
  const boot = getBootstrap();
  if (!boot.user) {
    const s = createMemoryStore();
    stores.set(courseId, s);
    return s;
  }
  const progress = bootstrappedProgress(courseId);
  if (progress === undefined) throw new Error(`Progress for "${courseId}" is not on this page: use loadStore()`);
  return syncedFor(courseId, progress);
}

/** Any course's store, fetching its progress first when the page doesn't carry it (Settings picker). */
export async function loadStore(courseId: string, fetchImpl: typeof fetch = fetch): Promise<Store> {
  const have = stores.get(courseId);
  if (have) return have;
  const boot = getBootstrap();
  if (!boot.user || bootstrappedProgress(courseId) !== undefined) return getStore(courseId);
  const res = await fetchImpl(`/api/courses/${courseId}/progress`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
  if (!res.ok) throw new Error(`Could not load progress (${res.status})`);
  return stores.get(courseId) ?? syncedFor(courseId, await res.json());
}

/** Test hook: drop the page singleton. */
export function resetStoreSingleton() {
  stores.clear();
}
