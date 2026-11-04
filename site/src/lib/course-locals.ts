// Learn30 — the course a page is rendering, for components that cannot receive it as a prop (those
// embedded in lesson MDX: Recap, Orientation, QuizSlot, MockLaunch, Remediation…). Each course page sets
// `Astro.locals.courseId` before rendering; components read it here.
import { getCourse, type CourseContext } from './course-data';
import { DEFAULT_COURSE_ID } from './routes';

export function courseOf(astro: { locals: App.Locals }): CourseContext {
  return getCourse(astro.locals.courseId ?? DEFAULT_COURSE_ID);
}
