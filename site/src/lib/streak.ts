// T108 — study streaks on local calendar dates (YYYY-MM-DD). A streak grows when a day is completed
// on the calendar date right after `lastStudyDate`; the same date never counts twice.
import type { Progress } from './types';

export type Streak = Progress['streak'];

export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days from date a to date b (both YYYY-MM-DD). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export function recordStudyDay(s: Streak, date: string): Streak {
  if (s.lastStudyDate === date) return { ...s };
  const current = s.lastStudyDate && daysBetween(s.lastStudyDate, date) === 1 ? s.current + 1 : 1;
  return { current, longest: Math.max(s.longest, current), lastStudyDate: date };
}

/** The streak to display today: it lapses once a whole calendar day passes with no study. */
export function currentStreak(s: Streak, today: string): number {
  if (!s.lastStudyDate) return 0;
  return daysBetween(s.lastStudyDate, today) <= 1 ? s.current : 0;
}
