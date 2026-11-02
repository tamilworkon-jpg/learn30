// T087 — mock exam logic (pure; no DOM): deadline persisted in progress.inProgress so a reload resumes the clock,
// expiry auto-submits, scaled score 100–1000 with pass at 700, readiness at ≥ 80%.
import { byDomain, isPass, scoreAttempt } from './scoring';
import type { Store } from './progress/store';
import type { Answer, Attempt, DomainScores, Question, Score } from './types';

export const MOCK_MINUTES = 90;
export const MOCK_QUESTIONS = 65;
export const PASS_SCALED = 700;
export const READY_PERCENT = 80;
const MIN = 60_000;
export const WARN_MS = 10 * MIN;
export const DANGER_MS = 2 * MIN;
export const ANNOUNCE_EVERY_MS = 5 * MIN;

export const deadlineFor = (startMs: number, minutes = MOCK_MINUTES) =>
  new Date(startMs + minutes * MIN).toISOString();
export const remainingMs = (deadline: string, now = Date.now()) => Math.max(0, Date.parse(deadline) - now);

/** mm:ss, rounding up so the clock shows 00:00 only when time is really up. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export type TimerPhase = 'normal' | 'warn' | 'danger';
export const timerPhase = (ms: number): TimerPhase =>
  ms < DANGER_MS ? 'danger' : ms < WARN_MS ? 'warn' : 'normal';

/** Screen-reader text when the clock crosses a 5-minute mark between two ticks, else null. */
export function announcement(prevMs: number, ms: number): string | null {
  const mark = Math.ceil(ms / ANNOUNCE_EVERY_MS) * ANNOUNCE_EVERY_MS;
  if (mark <= 0 || prevMs <= mark) return null;
  return `${mark / MIN} minutes remaining`;
}

export const isReady = (percent: number) => percent >= READY_PERCENT;

export interface MockResult {
  score: Score;
  byDomain: DomainScores;
  pass: boolean;
  ready: boolean;
}

/** Unanswered questions count as incorrect (scoreQuestion returns false for undefined). */
export function mockResult(questions: Question[], answers: Record<string, Answer>): MockResult {
  const score = scoreAttempt(questions, answers, true);
  return {
    score,
    byDomain: byDomain(questions, answers),
    pass: isPass(score.scaled!, PASS_SCALED),
    ready: isReady(score.percent),
  };
}

export type MockStatus = 'idle' | 'running' | 'expired';

export function createMockSession(
  store: Store,
  assessmentId: string,
  questions: Question[],
  opts: { now?: () => number; minutes?: number } = {},
) {
  const now = opts.now ?? Date.now;
  const known = new Set(questions.map((q) => q.id));
  const saved = store.get().inProgress[assessmentId];
  let deadline = saved?.deadline;
  let answers: Record<string, Answer> = deadline
    ? Object.fromEntries(Object.entries(saved?.answers ?? {}).filter(([id]) => known.has(id)))
    : {};
  let flagged: string[] = deadline ? (saved?.flagged ?? []).filter((id) => known.has(id)) : [];

  const persist = () => store.saveInProgress(assessmentId, { answers, flagged, deadline });
  const remaining = () => (deadline ? remainingMs(deadline, now()) : (opts.minutes ?? MOCK_MINUTES) * MIN);

  return {
    status(): MockStatus {
      if (!deadline) return 'idle';
      return remaining() > 0 ? 'running' : 'expired';
    },
    /** Starts the clock once; calling again (e.g. after a reload) never extends the deadline. */
    start() {
      if (deadline) return;
      deadline = deadlineFor(now(), opts.minutes);
      answers = {};
      flagged = [];
      persist();
    },
    deadline: () => deadline,
    remaining,
    answers: () => answers,
    flagged: () => flagged,
    answer(questionId: string, value: Answer) {
      if (!known.has(questionId) || !deadline) return;
      const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0;
      answers = { ...answers };
      if (empty) delete answers[questionId];
      else answers[questionId] = value;
      persist();
    },
    toggleFlag(questionId: string) {
      if (!known.has(questionId) || !deadline) return;
      flagged = flagged.includes(questionId)
        ? flagged.filter((id) => id !== questionId)
        : [...flagged, questionId];
      persist();
    },
    submit(autoSubmitted = false): Attempt {
      const r = mockResult(questions, answers);
      const attempt = store.recordAttempt({
        assessmentId,
        kind: 'mock',
        startedAt: store.get().inProgress[assessmentId]?.startedAt ?? new Date(now()).toISOString(),
        answers,
        flagged,
        score: r.score,
        byDomain: r.byDomain,
        autoSubmitted,
      });
      deadline = undefined;
      answers = {};
      flagged = [];
      return attempt;
    },
    lastAttempt: () =>
      store
        .get()
        .attempts.filter((a) => a.assessmentId === assessmentId)
        .at(-1),
  };
}

export type MockSession = ReturnType<typeof createMockSession>;
