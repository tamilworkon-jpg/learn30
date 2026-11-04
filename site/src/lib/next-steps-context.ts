// Build-time data for the quiz's "What's next" panel: day, next day, badge weeks and readable titles for
// the lesson sections the questions point at (`day-02#explanation` → "Day 2 · The language of …").
import { weeksFromCourse } from './badges';
import type { Course } from './types';
import { parseLesson } from './lesson-parse';
import { getPrevNext, sectionTypeLabel } from './lesson-utils';
import type { Question } from './types';

export function nextStepsContext(course: Course, courseId: string, day: number, questions: Pick<Question, 'lessonRef'>[], lessons: { day: number; body?: string }[]) {
  const titles: Record<string, string> = {};
  const parsed = new Map<number, ReturnType<typeof parseLesson>['sections']>();
  for (const { lessonRef } of questions) {
    if (titles[lessonRef]) continue;
    const [d, anchor] = lessonRef.split('#');
    const n = Number(d.replace(/\D/g, ''));
    if (!parsed.has(n)) parsed.set(n, parseLesson(lessons.find((l) => l.day === n)?.body ?? '').sections);
    const sec = parsed.get(n)!.find((s) => s.id === anchor);
    if (sec) titles[lessonRef] = `Day ${n} · ${sec.title || sectionTypeLabel[sec.type] || sec.type}`;
  }
  return { courseId, day, nextDay: getPrevNext(day, course).next, weeks: weeksFromCourse(course), totalDays: course.days.length, sectionTitles: titles };
}
