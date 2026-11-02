import { EXAM_GUIDE_VERSION } from '../constants';
import { localDate, recordStudyDay } from '../streak';
import type { Attempt, Progress } from '../types';
import validateProgress from '../../schemas/generated/validate-progress';

import { readActiveProfileId, progressKey, STORAGE_KEY } from './keys';

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

export function createStore(storage: Storage | null = browserStorage(), key: string = STORAGE_KEY) {
  let recovered = false;
  let persistent = storage !== null;
  let state: Progress;
  const read = (key: string) => {
    try {
      return storage?.getItem(key) ?? null;
    } catch {
      persistent = false;
      return null;
    }
  };
  const write = (key: string, value: string) => {
    if (!storage) return;
    try {
      storage.setItem(key, value);
      persistent = true;
    } catch {
      persistent = false; // quota exceeded / blocked: keep working in memory for this session
    }
  };
  const raw = read(key);
  try {
    const parsed = raw ? JSON.parse(raw) : defaultProgress();
    if (!validateProgress(parsed)) throw new Error('invalid');
    state = normalize(parsed as Progress);
  } catch {
    recovered = raw !== null;
    // Keep the FIRST unreadable copy: a later recovery must not overwrite the original backup.
    if (raw !== null && read(`${key}:backup`) === null) write(`${key}:backup`, raw);
    state = defaultProgress();
  }
  const listeners = new Set<Listener>();

  const save = () => {
    write(key, JSON.stringify(state));
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
    /** false when progress can't be saved (storage blocked or full) — UI may warn the learner. */
    get persistent() {
      return persistent;
    },
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
    saveInProgress(assessmentId: string, data: { answers: Progress['inProgress'][string]['answers']; flagged: string[]; deadline?: string }) {
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
    setTheme(theme: 'light' | 'dark') {
      state.settings.theme = theme;
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

export type Store = ReturnType<typeof createStore>;

let singleton: Store | null = null;
/** Store of the active learner profile (T184). Switching profiles reloads the page, so one per page load. */
export function getStore(): Store {
  if (!singleton) {
    const storage = browserStorage();
    singleton = createStore(storage, progressKey(readActiveProfileId(storage)));
  }
  return singleton;
}
