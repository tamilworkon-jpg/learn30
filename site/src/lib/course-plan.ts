// US3 — serialisable course plan (weeks → days → sections) built at build time from course.yaml
// plus whichever lesson files exist, and passed to client islands as props.
import { parseLesson } from './lesson-parse';
import { coreMinutes, sectionTypeLabel } from './lesson-utils';
import type { Course, DayKind, Domain, DomainId } from './types';

export interface PlanSection {
  id: string;
  title: string;
  minutes: number;
  optional: boolean;
}
export interface PlanDay {
  day: number;
  kind: DayKind;
  title: string;
  taskStatements: string[];
  week: number;
  domains: DomainId[];
  /** false = no content yet ("Coming soon"). Review/mock days are rendered by their own layouts. */
  available: boolean;
  sections: PlanSection[];
  minutes: number;
}
export interface PlanWeek {
  number: number;
  title: string;
  badge: string;
  days: number[];
}
export interface CoursePlan {
  weeks: PlanWeek[];
  days: PlanDay[];
  domains: Domain[];
}

const DEFAULT_MINUTES = 60;

export function buildPlan(course: Course, domains: Domain[], lessons: { day: number; body?: string }[]): CoursePlan {
  const domainOf = (ts: string) => domains.find((d) => d.tasks.some((t) => t.id === ts))?.id;
  const weekOf = (day: number) => course.weeks.find((w) => day >= w.days[0] && day <= w.days[1])!.number;
  const days = course.days.map((cd): PlanDay => {
    const lesson = lessons.find((l) => l.day === cd.day);
    const parsed = lesson ? parseLesson(lesson.body ?? '').sections : [];
    return {
      day: cd.day,
      kind: cd.kind,
      title: cd.title,
      taskStatements: cd.taskStatements,
      week: weekOf(cd.day),
      domains: [...new Set(cd.taskStatements.map(domainOf).filter((d): d is DomainId => Boolean(d)))],
      available: cd.kind !== 'lesson' || Boolean(lesson),
      sections: parsed.map((s) => ({ id: s.id, title: s.title || sectionTypeLabel[s.type] || s.type, minutes: s.minutes, optional: s.optional })),
      minutes: parsed.length ? coreMinutes(parsed) : DEFAULT_MINUTES,
    };
  });
  return {
    weeks: course.weeks.map((w) => ({ number: w.number, title: w.title, badge: w.badge, days: days.filter((d) => d.week === w.number).map((d) => d.day) })),
    days,
    // Objectives text isn't needed client-side; keep the island props small.
    domains: domains.map((d) => ({ ...d, tasks: d.tasks.map((t) => ({ id: t.id, title: t.title, objectives: [] })) })),
  };
}
