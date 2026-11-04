// @deprecated (Learn30 spec 002) — module-level single-course globals. Use getCourse(id) from
// ./course-data instead; kept only while pages migrate (W2). Re-exports the default course.
import { getCourse } from './course-data';
import { DEFAULT_COURSE_ID } from './routes';

const ctx = getCourse(DEFAULT_COURSE_ID);
export const examGuide = ctx.examGuide;
export const course = ctx.course;

export const taskStatementIds = examGuide.domains.flatMap((d) => d.tasks.map((t) => t.id));

export function domainOfTask(ts: string) {
  return examGuide.domains.find((d) => d.tasks.some((t) => t.id === ts))!;
}

export const pad = (n: number) => String(n).padStart(2, '0');
