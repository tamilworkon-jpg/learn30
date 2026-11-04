// The course registry as loaded at build time (see courses.ts for the type and validation). In e2e builds
// (AIP_FIXTURE_COURSES=1) the test-only fixture courses in tests/fixtures/courses/registry.yaml are appended.
import { load } from 'js-yaml';
import coursesRaw from '../data/courses.yaml?raw';
import type { CourseCard } from './courses';

const fixtureRegistry = import.meta.glob<string>('../../tests/fixtures/courses/registry.yaml', { query: '?raw', import: 'default', eager: true });

export const fixturesEnabled = typeof __AIP_FIXTURE_COURSES__ !== 'undefined' && __AIP_FIXTURE_COURSES__ === true;

export const courses: CourseCard[] = [
  ...(load(coursesRaw) as CourseCard[]),
  ...(fixturesEnabled ? Object.values(fixtureRegistry).flatMap((raw) => (load(raw) as CourseCard[] | null) ?? []) : []),
];
