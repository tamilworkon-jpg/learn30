import type { Course } from './types';
import type { ParsedSection } from './lesson-parse';

export const SECTION_ORDER = ['recap', 'objectives', 'explanation', 'diagram', 'examples', 'realWorld', 'handsOn', 'examTips', 'summary', 'quiz', 'deepDive'];

export type RecapData =
  | { kind: 'orientation' }
  | { kind: 'recap'; day: number; title: string; keyPoints: string[] }
  | { kind: 'missing'; day: number };

export function getRecapData(day: number, lessons: { day: number; title: string; keyPoints?: string[] }[]): RecapData {
  if (day === 1) return { kind: 'orientation' };
  const prev = lessons.find((l) => l.day === day - 1);
  if (!prev) return { kind: 'missing', day: day - 1 };
  return { kind: 'recap', day: prev.day, title: prev.title, keyPoints: prev.keyPoints ?? [] };
}

export const coreMinutes = (sections: ParsedSection[]) => sections.filter((s) => !s.optional).reduce((n, s) => n + s.minutes, 0);

export function getPrevNext(day: number, course: Course) {
  const days = course.days.map((d) => d.day);
  return { prev: days.includes(day - 1) ? day - 1 : null, next: days.includes(day + 1) ? day + 1 : null };
}

export const sectionTypeLabel: Record<string, string> = {
  orientation: 'Orientation',
  recap: 'Recap',
  objectives: 'Objectives',
  explanation: 'Explanation',
  diagram: 'Diagrams',
  examples: 'Examples',
  realWorld: 'Real world',
  handsOn: 'Hands-on lab',
  examTips: 'Exam tips',
  summary: 'Summary',
  quiz: 'Quiz',
  deepDive: 'Architect deep dive',
  conceptMap: 'Concept map',
  topFacts: 'Top facts',
  traps: 'Exam traps',
  launch: 'Mock exam',
  remediation: 'Remediation plan',
  finalRevision: 'Final revision',
  examStrategy: 'Exam-day strategy',
};
