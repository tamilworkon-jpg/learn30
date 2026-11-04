// Learn30 course loader (spec 002, contracts/course-folder.md). Every page, layout and component gets
// course data through getCourse(id) — never through module-level globals — so adding a course is a
// content change only: a registry entry (src/data/courses.yaml) + a folder src/courses/<id>/ with
// course.yaml, exam-guide.yaml, rules.yaml (+ optional metrics.ts) + content under src/content/<collection>/<id>/.
// Fixture courses (tests/fixtures/courses/<id>/, same layout) are included only in e2e builds.
// Pure Vite module (import.meta.glob, no astro:content): safe for pages and client islands alike.
import { load } from 'js-yaml';
import { courses, fixturesEnabled } from './courses-data';
import type { CourseCard } from './courses';
import type { Course, ExamGuide } from './types';

/** Course-specific assessment and validation rules (src/courses/<id>/rules.yaml). */
export interface CourseRules {
  /** Questions per mock exam, its time limit, scaled pass mark and the number of mocks. */
  mock: { questions: number; minutes: number; passScaled: number; count: number };
  /** Mock questions per exam domain (sums to mock.questions). */
  mockSplit: Record<string, number>;
  /** Day → mock numbers launched on that day. */
  mockLaunches: Record<number, number[]>;
  /** Day → required section order on mock days (optional; validate.ts has the AIF-C01 default). */
  mockSectionOrder?: Record<number, string[]>;
  /** Minimum unique questions in the bank (release gate). */
  minQuestions: number;
  /** Daily quiz size range. */
  dailyQuestions: [number, number];
  /** Weekly / module cumulative test size range. */
  moduleQuestions: [number, number];
  /** Core minutes per lesson day (default [50, 70] — a one-hour day). */
  lessonMinutes?: [number, number];
}

/** Cheat-sheet metric groups (optional src/courses/<id>/metrics.ts `metricGroups`). */
export interface CourseMetricGroup {
  title: string;
  [key: string]: unknown;
}

export interface CourseContext {
  /** Registry entry (src/data/courses.yaml): titles, exam code, accent, status… */
  meta: CourseCard;
  /** Plan: modules (topic groups), days, badges (course.yaml). */
  course: Course;
  /** The official exam / certification guide the course follows (exam-guide.yaml). */
  examGuide: ExamGuide;
  rules: CourseRules;
  /** Cheat-sheet metrics, when the course has them. */
  metrics?: CourseMetricGroup[];
}

type Raw = Record<string, string>;
const real: Raw = import.meta.glob<string>('../courses/*/{course,exam-guide,rules}.yaml', { query: '?raw', import: 'default', eager: true });
const fixtures: Raw = import.meta.glob<string>('../../tests/fixtures/courses/*/{course,exam-guide,rules}.yaml', { query: '?raw', import: 'default', eager: true });
const metricModules = import.meta.glob<{ metricGroups?: CourseMetricGroup[] }>('../courses/*/metrics.ts', { eager: true });

/** courseId → { course, exam-guide, rules } raw YAML. */
function filesById(): Map<string, Record<string, string>> {
  const out = new Map<string, Record<string, string>>();
  const add = (files: Raw) => {
    for (const [path, raw] of Object.entries(files)) {
      const m = /\/([a-z0-9-]+)\/(course|exam-guide|rules)\.yaml$/.exec(path);
      if (!m) continue;
      const entry = out.get(m[1]) ?? {};
      entry[m[2]] = raw;
      out.set(m[1], entry);
    }
  };
  add(real);
  if (fixturesEnabled) add(fixtures);
  return out;
}

const FILES = filesById();
const cache = new Map<string, CourseContext>();

/** All courses in the registry, in catalogue order. */
export function allCourses(): CourseCard[] {
  return courses;
}

/** Ids of courses whose pages are built (status 'available' and a course folder present). */
export function availableCourseIds(): string[] {
  return courses.filter((c) => c.status === 'available' && FILES.has(c.id)).map((c) => c.id);
}

/** Everything a course page needs. Throws for an unknown id (a build error, never a runtime one). */
export function getCourse(id: string): CourseContext {
  const hit = cache.get(id);
  if (hit) return hit;
  const meta = courses.find((c) => c.id === id);
  if (!meta) throw new Error(`Unknown course "${id}"`);
  const files = FILES.get(id);
  if (!files?.course || !files['exam-guide'] || !files.rules) throw new Error(`Course "${id}" needs course.yaml, exam-guide.yaml and rules.yaml in src/courses/${id}/`);
  const metrics = Object.entries(metricModules).find(([p]) => p.includes(`/${id}/metrics.ts`))?.[1].metricGroups;
  const ctx: CourseContext = {
    meta,
    course: load(files.course) as Course,
    examGuide: load(files['exam-guide']) as ExamGuide,
    rules: load(files.rules) as CourseRules,
    ...(metrics ? { metrics } : {}),
  };
  cache.set(id, ctx);
  return ctx;
}

export const taskStatementIdsOf = (ctx: CourseContext) => ctx.examGuide.domains.flatMap((d) => d.tasks.map((t) => t.id));

export function domainOfTaskIn(ctx: CourseContext, ts: string) {
  return ctx.examGuide.domains.find((d) => d.tasks.some((t) => t.id === ts))!;
}
