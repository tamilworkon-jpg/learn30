// Learn30 — which course the current page belongs to (shared by the progress store and UiState).
import { getBootstrap } from './bootstrap';
import { courseIdFromPath, DEFAULT_COURSE_ID } from './routes';

/**
 * <html data-course> (set by the layout on course pages), else the bootstrap's course, else a
 * /course/<id>/… URL, else the first course (global pages and pre-Learn30 URLs).
 */
export function currentCourseId(): string {
  if (typeof document !== 'undefined') {
    const fromHtml = document.documentElement.dataset.course;
    if (fromHtml) return fromHtml;
  }
  const boot = getBootstrap();
  if (boot.course?.id) return boot.course.id;
  if (typeof location !== 'undefined') return courseIdFromPath(location.pathname) ?? DEFAULT_COURSE_ID;
  return DEFAULT_COURSE_ID;
}
