import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { validateCourses } from '../../src/lib/courses';

// Course catalogue: src/data/courses.yaml.
const raw = load(readFileSync('src/data/courses.yaml', 'utf8')) as Record<string, unknown>[];

describe('course catalogue', () => {
  it('C1 the catalogue is valid and course #1 is the AWS AI Practitioner course at the existing routes', () => {
    expect(validateCourses(raw)).toEqual([]);
    expect(raw[0]).toMatchObject({ id: 'aws-ai-practitioner', examCode: 'AIF-C01', status: 'available', entryHref: '/course/aws-ai-practitioner', outlineHref: '/outline', lengthDays: 30 });
  });

  it('C2 validation reports missing fields, bad ids, duplicates, status, paths and colours', () => {
    const ok = raw[0];
    expect(validateCourses([])).toEqual(['courses.yaml must be a non-empty list']);
    expect(validateCourses([{ ...ok, title: '' }])).toEqual(['courses[0].title: required text']);
    expect(validateCourses([{ ...ok, id: 'Bad Id' }])).toContain('courses[0].id: lower-case letters, digits and dashes');
    expect(validateCourses([ok, ok])).toContain('courses[1].id: duplicate "aws-ai-practitioner"');
    expect(validateCourses([{ ...ok, status: 'draft' }])).toEqual(['courses[0].status: available | coming-soon']);
    expect(validateCourses([{ ...ok, entryHref: 'https://evil.example' }])).toEqual(['courses[0].entryHref: site-relative path']);
    expect(validateCourses([{ ...ok, accent: 'purple' }])).toEqual(['courses[0].accent: #rrggbb']);
    expect(validateCourses([{ ...ok, lengthDays: 0 }])).toEqual(['courses[0].lengthDays: positive integer']);
  });
});
