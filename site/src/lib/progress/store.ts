import { EXAM_GUIDE_VERSION } from '../constants';
import type { Attempt, Progress } from '../types';
import validateProgress from '../../schemas/generated/validate-progress';

export const STORAGE_KEY = 'aip-course:v1';
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

export function createStore(storage: Storage = localStorage) {
  let recovered = false;
  let state: Progress;
  const raw = storage.getItem(STORAGE_KEY);
  try {
    const parsed = raw ? JSON.parse(raw) : defaultProgress();
    if (!validateProgress(parsed)) throw new Error('invalid');
    state = normalize(parsed as Progress);
  } catch {
    recovered = raw !== null;
    if (raw !== null) storage.setItem(`${STORAGE_KEY}:backup`, raw);
    state = defaultProgress();
  }
  const listeners = new Set<Listener>();

  const save = () => {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    setRating(week: string, value: number) {
      if (!/^week-[1-4]$/.test(week) || !Number.isInteger(value) || value < 1 || value > 5) throw new Error('Invalid rating');
      state.ratings[week] = value;
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
export function getStore(): Store {
  return (singleton ??= createStore());
}
