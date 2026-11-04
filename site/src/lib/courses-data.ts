// The course catalogue as loaded at build time (see courses.ts for the type and validation).
import { load } from 'js-yaml';
import coursesRaw from '../data/courses.yaml?raw';
import type { CourseCard } from './courses';

export const courses = load(coursesRaw) as CourseCard[];
