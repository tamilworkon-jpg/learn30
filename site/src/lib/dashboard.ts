// US3 — pure helpers behind the dashboard islands (no DOM, no storage).
import type { CoursePlan, PlanDay } from './course-plan';
import type { DayState, Progress } from './types';

export type Status = DayState['status'];

export const dayStatus = (p: Progress, day: number): Status => p.days[String(day)]?.status ?? 'not-started';

export function completedCount(p: Progress, plan: CoursePlan): number {
  return plan.days.filter((d) => dayStatus(p, d.day) === 'completed').length;
}

export function percentComplete(p: Progress, plan: CoursePlan): number {
  return Math.round((100 * completedCount(p, plan)) / plan.days.length);
}

/** Core minutes still to study for a day (sections not yet viewed). */
export function minutesLeft(p: Progress, d: PlanDay): number {
  if (dayStatus(p, d.day) === 'completed') return 0;
  const viewed = new Set(p.days[String(d.day)]?.sectionsViewed ?? []);
  if (!d.sections.length) return d.minutes;
  return d.sections.filter((s) => !s.optional && !viewed.has(s.id)).reduce((n, s) => n + s.minutes, 0);
}

/** Share of core sections viewed, 0–100. */
export function sectionProgress(p: Progress, d: PlanDay): number {
  if (dayStatus(p, d.day) === 'completed') return 100;
  const core = d.sections.filter((s) => !s.optional);
  if (!core.length) return 0;
  const viewed = new Set(p.days[String(d.day)]?.sectionsViewed ?? []);
  return Math.round((100 * core.filter((s) => viewed.has(s.id)).length) / core.length);
}

export interface ContinueTarget {
  day: number;
  sectionId?: string;
  href: string;
  resumed: boolean;
}

const dayHref = (day: number, sectionId?: string) => `/day/${String(day).padStart(2, '0')}${sectionId ? `#${sectionId}` : ''}`;

/** T072 — lastPosition (unless that day is already complete) → else next incomplete day → else Day 1. */
export function continueTarget(p: Progress, plan: CoursePlan): ContinueTarget {
  const lp = p.lastPosition;
  if (lp && plan.days.some((d) => d.day === lp.day) && dayStatus(p, lp.day) !== 'completed') {
    return { day: lp.day, sectionId: lp.sectionId, href: dayHref(lp.day, lp.sectionId), resumed: true };
  }
  const next = plan.days.find((d) => dayStatus(p, d.day) !== 'completed');
  const day = next?.day ?? plan.days[0].day;
  return { day, href: dayHref(day), resumed: false };
}

/** The days after `day`, for the "up next" cards. */
export function upcoming(plan: CoursePlan, day: number, count: number): PlanDay[] {
  const i = plan.days.findIndex((d) => d.day === day);
  return plan.days.slice(i + 1, i + 1 + count);
}

export { dayHref };
