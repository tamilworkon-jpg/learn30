// Learn30 course loader (spec 002, contracts/course-folder.md). Every page, layout and component gets
// course data through getCourse(id) — never through module-level globals — so adding a course is a
// content change only.
//
// W0 (interim): wraps the single course's existing files (src/data/course.yaml, exam-guide.yaml and the
// global constants). W1 replaces the internals with per-course folders (src/courses/<id>/…) and
// course-scoped content collections; the exported API below stays the same.
import { courses } from './courses-data';
import type { CourseCard } from './courses';
import { course as legacyCourse, examGuide as legacyGuide } from './data';
import type { Course, ExamGuide } from './types';

/** Course-specific assessment and validation rules (src/courses/<id>/rules.yaml). */
export interface CourseRules {
  /** Questions per mock exam and its time limit. */
  mock: { questions: number; minutes: number; passScaled: number; count: number };
  /** Mock questions per exam domain (sums to mock.questions). */
  mockSplit: Record<string, number>;
  /** Day → mock numbers launched on that day. */
  mockLaunches: Record<number, number[]>;
  /** Minimum unique questions in the bank (release gate). */
  minQuestions: number;
  /** Daily quiz size range. */
  dailyQuestions: [number, number];
  /** Weekly / module cumulative test size range. */
  moduleQuestions: [number, number];
}

export interface CourseContext {
  /** Registry entry (src/data/courses.yaml): titles, exam code, accent, status… */
  meta: CourseCard;
  /** Plan: modules (topic groups), days, badges (course.yaml). */
  course: Course;
  /** The official exam / certification guide the course follows (exam-guide.yaml). */
  examGuide: ExamGuide;
  rules: CourseRules;
}

const AWS_RULES: CourseRules = {
  mock: { questions: 65, minutes: 90, passScaled: 700, count: 3 },
  mockSplit: { D1: 13, D2: 16, D3: 18, D4: 9, D5: 9 },
  mockLaunches: { 29: [1], 30: [2, 3] },
  minQuestions: 900,
  dailyQuestions: [15, 20],
  moduleQuestions: [55, 60],
};

/** All courses in the registry, in catalogue order. */
export function allCourses(): CourseCard[] {
  return courses;
}

/** Ids of courses whose pages are built (status 'available'). */
export function availableCourseIds(): string[] {
  return courses.filter((c) => c.status === 'available').map((c) => c.id);
}

/** Everything a course page needs. Throws for an unknown id (a build error, never a runtime one). */
export function getCourse(id: string): CourseContext {
  const meta = courses.find((c) => c.id === id);
  if (!meta) throw new Error(`Unknown course "${id}"`);
  // Interim: only the first course exists; W1 loads src/courses/<id>/ here.
  return { meta, course: legacyCourse, examGuide: legacyGuide, rules: AWS_RULES };
}

export const taskStatementIdsOf = (ctx: CourseContext) => ctx.examGuide.domains.flatMap((d) => d.tasks.map((t) => t.id));

export function domainOfTaskIn(ctx: CourseContext, ts: string) {
  return ctx.examGuide.domains.find((d) => d.tasks.some((t) => t.id === ts))!;
}
