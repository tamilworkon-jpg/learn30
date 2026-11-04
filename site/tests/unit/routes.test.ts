import { describe, expect, it } from 'vitest';
import { CATALOGUE_HREF, DEFAULT_COURSE_ID, courseHref, courseIdFromPath, isCoursePath, legacyCoursePath } from '../../src/lib/routes';

// Learn30 route helpers (spec 002 contracts/routes.md).
describe('courseHref', () => {
  it('RT1 builds every course page under /course/<id>', () => {
    expect(courseHref('demo-course')).toBe('/course/demo-course');
    expect(courseHref('demo-course', 'dashboard')).toBe('/course/demo-course');
    expect(courseHref('demo-course', 'day', 3)).toBe('/course/demo-course/day/03');
    expect(courseHref('aws-ai-practitioner', 'day', 12, 'quiz')).toBe('/course/aws-ai-practitioner/day/12#quiz');
    expect(courseHref('demo-course', 'mock', 1)).toBe('/course/demo-course/mock/1');
    expect(courseHref('demo-course', 'outline')).toBe('/course/demo-course/outline');
    expect(courseHref('demo-course', 'glossary')).toBe('/course/demo-course/glossary');
    expect(courseHref('demo-course', 'cheatsheet')).toBe('/course/demo-course/cheatsheet/services');
    expect(courseHref('demo-course', 'cheatsheet', 'metrics')).toBe('/course/demo-course/cheatsheet/metrics');
    expect(courseHref('demo-course', 'coverage')).toBe('/course/demo-course/coverage');
    expect(courseHref('demo-course', 'search')).toBe('/course/demo-course/search');
  });
});

describe('courseIdFromPath', () => {
  it('RT2 reads the course of a course page; null on global pages', () => {
    expect(courseIdFromPath('/course/demo-course')).toBe('demo-course');
    expect(courseIdFromPath('/course/demo-course/')).toBe('demo-course');
    expect(courseIdFromPath('/course/aws-ai-practitioner/day/02')).toBe('aws-ai-practitioner');
    for (const p of ['/', '/settings', '/login', '/signup', '/courses', '/course', '/course/', '/coursework/x', '/course/Bad_Id/day/01']) expect(courseIdFromPath(p), p).toBeNull();
    expect(isCoursePath('/course/demo-course/outline')).toBe(true);
    expect(isCoursePath('/settings')).toBe(false);
  });
});

describe('legacyCoursePath', () => {
  it('RT3 maps pre-Learn30 root pages into the first course', () => {
    const c = `/course/${DEFAULT_COURSE_ID}`;
    expect(legacyCoursePath('/courses')).toBe(CATALOGUE_HREF);
    expect(legacyCoursePath('/courses/')).toBe(CATALOGUE_HREF);
    expect(legacyCoursePath('/day/02')).toBe(`${c}/day/02`);
    expect(legacyCoursePath('/day/02/')).toBe(`${c}/day/02`);
    expect(legacyCoursePath('/mock/1')).toBe(`${c}/mock/1`);
    expect(legacyCoursePath('/outline')).toBe(`${c}/outline`);
    expect(legacyCoursePath('/glossary')).toBe(`${c}/glossary`);
    expect(legacyCoursePath('/coverage')).toBe(`${c}/coverage`);
    expect(legacyCoursePath('/search')).toBe(`${c}/search`);
    expect(legacyCoursePath('/cheatsheet/services')).toBe(`${c}/cheatsheet/services`);
    expect(legacyCoursePath('/cheatsheet/metrics')).toBe(`${c}/cheatsheet/metrics`);
  });

  it('RT4 leaves current and unknown paths alone', () => {
    for (const p of ['/', '/settings', '/login', '/course/demo-course/day/01', '/day/2', '/day/02/extra', '/mock/x', '/api/progress', '/glossary.css']) expect(legacyCoursePath(p), p).toBeNull();
  });
});
