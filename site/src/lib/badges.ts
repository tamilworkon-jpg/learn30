// T108 — badges (ids from course.yaml `badges`). Derived from progress, so they also appear after an
// import or a mock taken elsewhere; earned badges are persisted with store.awardBadges().
import type { Course, Progress } from './types';

export interface BadgeInfo {
  emoji: string;
  label: string;
  description: string;
}

export const BADGES: Record<string, BadgeInfo> = {
  'week-1': { emoji: '🧠', label: 'Module 1', description: 'Completed Module 1 — AI & ML foundations' },
  'week-2': { emoji: '✨', label: 'Module 2', description: 'Completed Module 2 — Generative AI & agents' },
  'week-3': { emoji: '🛠️', label: 'Module 3', description: 'Completed Module 3 — Building with foundation models' },
  'week-4': { emoji: '🛡️', label: 'Module 4', description: 'Completed Module 4 — Responsible, secure & governed AI' },
  'mock-pass': { emoji: '🎯', label: 'Mock pass', description: 'Scored 700+ on a mock exam' },
  'streak-7': { emoji: '🔥', label: '7-day streak', description: 'Studied 7 study days in a row (weekends never break it)' },
  'course-complete': { emoji: '🏆', label: 'Course complete', description: 'Completed all 30 days' },
};

export const BADGE_ORDER = ['week-1', 'week-2', 'week-3', 'week-4', 'mock-pass', 'streak-7', 'course-complete'];

export type BadgeWeek = { badge: string; days: number[] };

export function weeksFromCourse(course: Pick<Course, 'weeks'>): BadgeWeek[] {
  return course.weeks.map((w) => ({ badge: w.badge, days: Array.from({ length: w.days[1] - w.days[0] + 1 }, (_, i) => w.days[0] + i) }));
}

export function earnedBadges(p: Progress, weeks: BadgeWeek[], totalDays: number): string[] {
  const done = (n: number) => p.days[String(n)]?.status === 'completed';
  const earned = new Set<string>();
  for (const w of weeks) if (/^week-\d$/.test(w.badge) && w.days.every(done)) earned.add(w.badge);
  if (p.attempts.some((a) => a.kind === 'mock' && (a.score.scaled ?? 0) >= 700)) earned.add('mock-pass');
  if (p.streak.longest >= 7) earned.add('streak-7');
  if (Array.from({ length: totalDays }, (_, i) => i + 1).every(done)) earned.add('course-complete');
  return BADGE_ORDER.filter((id) => earned.has(id));
}

export const newBadges = (before: string[], after: string[]) => after.filter((id) => !before.includes(id));
