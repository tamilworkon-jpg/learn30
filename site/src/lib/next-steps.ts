// "What's next" after a quiz (learner feedback 2026-11-03): pass → complete the day and move on;
// below the pass mark → the lesson sections behind the wrong answers, then retake.
import { courseHref, DEFAULT_COURSE_ID } from './routes';
import { scoreQuestion } from './scoring';
import type { Attempt, Question } from './types';

export const PASS_MARK = 80;

export const passed = (percent: number) => Math.round(percent) >= PASS_MARK;

/** `day-02#explanation` → `/course/<id>/day/02#explanation`. */
export function lessonHref(ref: string, courseId: string = DEFAULT_COURSE_ID): string {
  const [day, anchor] = ref.split('#');
  return courseHref(courseId, 'day', Number(day.replace(/\D/g, '')), anchor || undefined);
}

export interface RevisitLink {
  ref: string;
  href: string;
  title: string;
  /** Wrong answers that point at this section. */
  misses: number;
}

/** Unique lesson sections behind the wrongly answered questions — most misses first, then question order. */
export function revisitLinks(questions: Question[], answers: Attempt['answers'], titles: Record<string, string> = {}, courseId: string = DEFAULT_COURSE_ID): RevisitLink[] {
  const out = new Map<string, RevisitLink>();
  for (const q of questions) {
    if (scoreQuestion(q, answers[q.id])) continue;
    const hit = out.get(q.lessonRef);
    if (hit) hit.misses++;
    else out.set(q.lessonRef, { ref: q.lessonRef, href: lessonHref(q.lessonRef, courseId), title: titles[q.lessonRef] ?? fallbackTitle(q.lessonRef), misses: 1 });
  }
  return [...out.values()].sort((a, b) => b.misses - a.misses);
}

function fallbackTitle(ref: string): string {
  const [day, anchor = ''] = ref.split('#');
  const n = Number(day.replace(/\D/g, ''));
  const words = anchor.replace(/-/g, ' ');
  return `${n ? `Day ${n} · ` : ''}${words.charAt(0).toUpperCase()}${words.slice(1)}`;
}
