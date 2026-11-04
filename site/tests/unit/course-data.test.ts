import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { allCourses, availableCourseIds, getCourse } from '../../src/lib/course-data';
import { DEFAULT_COURSE_ID } from '../../src/lib/routes';
import { DEFAULT_RULES, validateContent } from '../../src/lib/validate';
import type { Question } from '../../src/lib/types';

// Learn30 spec 002 (contracts/course-folder.md): course data comes from src/courses/<id>/ via getCourse().
describe('course loader (L011)', () => {
  it('CD1 the registry lists the AWS course first and it is built', () => {
    expect(allCourses()[0].id).toBe(DEFAULT_COURSE_ID);
    expect(availableCourseIds()).toContain(DEFAULT_COURSE_ID);
  });

  it('CD2 getCourse() loads plan, guide and rules from the course folder', () => {
    const c = getCourse(DEFAULT_COURSE_ID);
    expect(c.meta.examCode).toBe('AIF-C01');
    expect(c.examGuide.examCode).toBe('AIF-C01');
    expect(c.course.days).toHaveLength(30);
    expect(c.rules).toEqual({ ...DEFAULT_RULES });
    expect(c.metrics?.length).toBeGreaterThan(0);
    expect(getCourse(DEFAULT_COURSE_ID)).toBe(c); // cached
  });

  it('CD3 unknown course ids are a build error', () => {
    expect(() => getCourse('no-such-course')).toThrow(/Unknown course/);
  });
});

describe('per-course validation rules (L012)', () => {
  const { course, examGuide } = getCourse(DEFAULT_COURSE_ID);
  const day2 = load(readFileSync('src/content/questions/aws-ai-practitioner/day-02.yaml', 'utf8')) as Question[];
  const run = (rules = DEFAULT_RULES) => validateContent({ lessons: [], questionSets: [{ set: 'day-02', questions: day2 }], guide: examGuide, course, rules }).errors.filter((e) => e.startsWith('day-02 has'));

  it('VR1 quiz sizes come from the course rules', () => {
    expect(run()).toEqual([]);
    expect(run({ ...DEFAULT_RULES, dailyQuestions: [25, 30] })[0]).toMatch(/expected 25–30/);
  });

  it('VR2 the release-gate bank size comes from the course rules', () => {
    const gate = (min: number) =>
      validateContent({ lessons: [], questionSets: [{ set: 'day-02', questions: day2 }], guide: examGuide, course, rules: { ...DEFAULT_RULES, minQuestions: min }, final: true }).errors.some((e) => e.startsWith('Question bank'));
    expect(gate(5)).toBe(false);
    expect(gate(900)).toBe(true);
  });
});
