// Attempt history: every submitted attempt of one quiz, weekly test or mock exam, numbered #1, #2, … in the
// order they were taken. Pure helpers over progress.attempts; the store and data model are unchanged.
import { PASS_SCALED } from './mock';
import { isPass, toScaled } from './scoring';
import type { Attempt, Progress } from './types';

export interface HistoryRow {
  /** 1-based attempt number, oldest = #1. */
  number: number;
  attempt: Attempt;
  correct: number;
  total: number;
  /** Whole-number percentage. */
  percent: number;
  /** Mock exams only: scaled 100–1000 score and pass at 700. */
  scaled?: number;
  passed?: boolean;
  /** Milliseconds from start to submit (null when the timestamps are missing or out of order). */
  durationMs: number | null;
  isBest: boolean;
  isLatest: boolean;
}

export interface History {
  rows: HistoryRow[];
  best: HistoryRow | null;
  latest: HistoryRow | null;
}

const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
};

export function attemptsFor(progress: Pick<Progress, 'attempts'>, assessmentId: string): History {
  const list = progress.attempts
    .filter((a) => a.assessmentId === assessmentId)
    .map((a, i) => ({ a, i }))
    // Oldest first; stable on equal timestamps (storage order).
    .sort((x, y) => time(x.a.submittedAt) - time(y.a.submittedAt) || x.i - y.i)
    .map((x) => x.a);
  const rows: HistoryRow[] = list.map((attempt, i) => {
    const { correct, total } = attempt.score;
    const percent = Math.round(attempt.score.percent);
    const mock = attempt.kind === 'mock';
    const scaled = mock ? (attempt.score.scaled ?? toScaled(correct, total)) : undefined;
    const start = time(attempt.startedAt);
    const end = time(attempt.submittedAt);
    return {
      number: i + 1,
      attempt,
      correct,
      total,
      percent,
      scaled,
      passed: scaled === undefined ? undefined : isPass(scaled, PASS_SCALED),
      durationMs: start && end && end >= start ? end - start : null,
      isBest: false,
      isLatest: i === list.length - 1,
    };
  });
  // Best = highest score (scaled for mocks, else percent); the earliest wins a tie.
  const value = (r: HistoryRow) => r.scaled ?? r.percent;
  const best = rows.reduce<HistoryRow | null>((b, r) => (b === null || value(r) > value(b) ? r : b), null);
  if (best) best.isBest = true;
  return { rows, best, latest: rows.at(-1) ?? null };
}

/** e.g. "3 Nov 2026, 14:05" in the browser's locale. */
export const formatWhen = (iso: string, locale?: string) =>
  new Date(iso).toLocaleString(locale, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** "12 min", "1 h 05 min", "45 s"; "—" when unknown. */
export function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}
