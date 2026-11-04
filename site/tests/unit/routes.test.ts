import { describe, expect, it } from 'vitest';
import { courseHref, courseIdFromPath, legacyCoursePath } from '../../src/lib/routes';

// Learn30 L021/L022 — every course link goes through courseHref; old root URLs map into the first course.
describe('course routes', () => {
  it('courseHref builds /course/<id>/… links', () => {
    expect(courseHref('aws-ai-practitioner')).toBe('/course/aws-ai-practitioner');
    expect(courseHref('demo', 'day', 2)).toBe('/course/demo/day/02');
    expect(courseHref('demo', 'day', 12, 'quiz')).toBe('/course/demo/day/12#quiz');
    expect(courseHref('demo', 'mock', 1)).toBe('/course/demo/mock/1');
    expect(courseHref('demo', 'cheatsheet', 'metrics')).toBe('/course/demo/cheatsheet/metrics');
    for (const p of ['outline', 'glossary', 'coverage', 'search'] as const) expect(courseHref('demo', p)).toBe(`/course/demo/${p}`);
  });
  it('courseIdFromPath: course pages vs global pages', () => {
    expect(courseIdFromPath('/course/demo/day/02')).toBe('demo');
    expect(courseIdFromPath('/course/demo')).toBe('demo');
    for (const p of ['/', '/settings', '/login', '/day/02']) expect(courseIdFromPath(p)).toBeNull();
  });
  it('legacyCoursePath: pre-Learn30 addresses', () => {
    expect(legacyCoursePath('/courses')).toBe('/');
    expect(legacyCoursePath('/day/07')).toBe('/course/aws-ai-practitioner/day/07');
    expect(legacyCoursePath('/mock/3')).toBe('/course/aws-ai-practitioner/mock/3');
    expect(legacyCoursePath('/cheatsheet/services')).toBe('/course/aws-ai-practitioner/cheatsheet/services');
    for (const p of ['/', '/settings', '/course/demo/day/02', '/day/2', '/login']) expect(legacyCoursePath(p)).toBeNull();
  });
});
