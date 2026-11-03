// T108 — study streaks on local calendar dates (YYYY-MM-DD). A streak grows when a day is completed
// on the next study day after `lastStudyDate`; weekends are not study days (the plan is Mon–Fri), so
// skipping them never breaks a streak, but studying on one still counts. The same date never counts twice.
import type { Progress } from './types';

export type Streak = Progress['streak'];

export function localDate(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days from date a to date b (both YYYY-MM-DD). */
function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Weekdays strictly between dates a and b (YYYY-MM-DD, a < b). */
function missedWeekdays(a: string, b: string): number {
  let n = 0;
  for (let t = Date.parse(`${a}T00:00:00Z`) + 86_400_000; t < Date.parse(`${b}T00:00:00Z`); t += 86_400_000) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

export function recordStudyDay(s: Streak, date: string): Streak {
  if (s.lastStudyDate === date) return { ...s };
  const current = s.lastStudyDate && daysBetween(s.lastStudyDate, date) >= 1 && missedWeekdays(s.lastStudyDate, date) === 0 ? s.current + 1 : 1;
  return { current, longest: Math.max(s.longest, current), lastStudyDate: date };
}

/** The streak to display today: it lapses once a whole study day (weekday) passes with no study. */
export function currentStreak(s: Streak, today: string): number {
  if (!s.lastStudyDate) return 0;
  return daysBetween(s.lastStudyDate, today) <= 1 || missedWeekdays(s.lastStudyDate, today) === 0 ? s.current : 0;
}
