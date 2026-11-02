import { load } from 'js-yaml';
import courseRaw from '../data/course.yaml?raw';
import guideRaw from '../data/exam-guide.yaml?raw';
import type { Course, ExamGuide } from './types';

export const examGuide = load(guideRaw) as ExamGuide;
export const course = load(courseRaw) as Course;

export const taskStatementIds = examGuide.domains.flatMap((d) => d.tasks.map((t) => t.id));

export function domainOfTask(ts: string) {
  return examGuide.domains.find((d) => d.tasks.some((t) => t.id === ts))!;
}

export const pad = (n: number) => String(n).padStart(2, '0');
