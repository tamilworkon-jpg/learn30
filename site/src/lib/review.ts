// T080/T081 — pure helpers for weekly review days (no DOM, no Astro imports; unit-tested).
import type { Attempt, Course, DomainId, ExamGuide, Question } from './types';
import { scoreQuestion } from './scoring';

/** A domain is "weak" below this percentage (data-model.md: weak domains < 70%). */
export const WEAK_THRESHOLD = 70;

export const weekOfDay = (course: Course, day: number) =>
  course.weeks.find((w) => day >= w.days[0] && day <= w.days[1]) ?? null;

/** Assessment id of the weekly test on a review day (`week-N`), or null for non-review days. */
export function weeklySetId(course: Course, day: number): string | null {
  const cd = course.days.find((d) => d.day === day);
  const week = weekOfDay(course, day);
  return cd?.kind === 'review' && week ? `week-${week.number}` : null;
}

export interface SummaryDay {
  day: number;
  title: string;
  taskStatements: string[];
}
export interface SummaryDomain {
  id: DomainId;
  name: string;
  days: SummaryDay[];
}

const domainOf = (guide: ExamGuide, ts: string) =>
  guide.domains.find((d) => d.tasks.some((t) => t.id === ts));

/** Every lesson day before `day`, grouped by the exam domain(s) of its task statements (a day can appear under several). */
export function summaryByDomain(course: Course, guide: ExamGuide, day: number): SummaryDomain[] {
  const lessons = course.days.filter((d) => d.kind === 'lesson' && d.day < day);
  return guide.domains
    .map((dom) => ({
      id: dom.id,
      name: dom.name,
      days: lessons
        .filter((l) => l.taskStatements.some((ts) => domainOf(guide, ts)?.id === dom.id))
        .map((l) => ({
          day: l.day,
          title: l.title,
          taskStatements: l.taskStatements.filter((ts) => domainOf(guide, ts)?.id === dom.id),
        })),
    }))
    .filter((d) => d.days.length > 0);
}

/** Lesson day number from a `day-NN#section` lessonRef. */
export const refDay = (lessonRef: string) => Number(/^day-(\d{2})#/.exec(lessonRef)?.[1] ?? 0);

export interface DomainRow {
  id: DomainId;
  correct: number;
  total: number;
  percent: number;
  weak: boolean;
  /** Lesson days to revisit: the days taught by the questions missed in this domain (ascending). */
  revisit: number[];
}

/** Per-domain rows for an attempt, in D1..D5 order, with "Revisit Day N" targets from missed questions. */
export function domainRows(
  attempt: Pick<Attempt, 'byDomain' | 'answers'>,
  questions: Pick<Question, 'id' | 'domain' | 'lessonRef' | 'type' | 'answer'>[],
): DomainRow[] {
  const ids: DomainId[] = ['D1', 'D2', 'D3', 'D4', 'D5'];
  return ids
    .filter((id) => attempt.byDomain[id]?.total)
    .map((id) => {
      const { correct, total } = attempt.byDomain[id]!;
      const percent = Math.round((100 * correct) / total);
      const missed = questions.filter(
        (q) => q.domain === id && !scoreQuestion(q as Question, attempt.answers[q.id]),
      );
      const revisit = [...new Set(missed.map((q) => refDay(q.lessonRef)).filter((n) => n > 0))].sort(
        (a, b) => a - b,
      );
      return { id, correct, total, percent, weak: percent < WEAK_THRESHOLD, revisit };
    });
}
