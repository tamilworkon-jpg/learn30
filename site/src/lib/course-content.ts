// Learn30 — a course's content collections (build time only: imports astro:content, so never import
// this from a client island). Pages/layouts/components call these instead of getCollection() so the
// collection layout (spec 002 contracts/course-folder.md) can change underneath them.
//
// W0 (interim): every entry belongs to the first course. W1 switches to course-scoped entries
// (ids `<courseId>/…`, `courseId` on each entry) without changing these signatures.
import { getCollection, type CollectionEntry } from 'astro:content';
import { DEFAULT_COURSE_ID } from './routes';

const ofCourse = <T>(courseId: string, all: T[]): T[] => (courseId === DEFAULT_COURSE_ID ? all : []);

export const lessonsOf = async (courseId: string): Promise<CollectionEntry<'lessons'>[]> => ofCourse(courseId, await getCollection('lessons'));
export const questionsOf = async (courseId: string): Promise<CollectionEntry<'questions'>[]> => ofCourse(courseId, await getCollection('questions'));
export const glossaryOf = async (courseId: string): Promise<CollectionEntry<'glossary'>[]> => ofCourse(courseId, await getCollection('glossary'));
export const servicesOf = async (courseId: string): Promise<CollectionEntry<'services'>[]> => ofCourse(courseId, await getCollection('services'));
