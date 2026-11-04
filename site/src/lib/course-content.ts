// Learn30 — a course's content collections (build time only: imports astro:content, so never import
// this from a client island). Pages/layouts/components call these instead of getCollection() so the
// collection layout (spec 002 contracts/course-folder.md) can change underneath them.
//
// Entries keep Astro's ids (`<courseId>/<local>`, so render() still works) and gain:
//   courseId — the owning course; localId — the id within the course (glossary/service anchors,
//   lesson file name `day-NN`, question id). Lessons are matched by `data.day`, questions by `data.set`.
import { getCollection, type CollectionEntry, type CollectionKey } from 'astro:content';

export type CourseEntry<C extends CollectionKey> = CollectionEntry<C> & { courseId: string; localId: string };

/** `<courseId>/<local>` → [courseId, local]. */
export function splitEntryId(id: string): [string, string] {
  const i = id.indexOf('/');
  return i < 0 ? ['', id] : [id.slice(0, i), id.slice(i + 1)];
}

async function entriesOf<C extends CollectionKey>(collection: C, courseId: string): Promise<CourseEntry<C>[]> {
  const all = (await getCollection(collection)) as CollectionEntry<C>[];
  const out: CourseEntry<C>[] = [];
  for (const e of all) {
    const [cid, localId] = splitEntryId(e.id);
    if (cid === courseId) out.push(Object.assign(Object.create(Object.getPrototypeOf(e)), e, { courseId: cid, localId }) as CourseEntry<C>);
  }
  return out;
}

export const lessonsOf = (courseId: string) => entriesOf('lessons', courseId);
export const questionsOf = (courseId: string) => entriesOf('questions', courseId);
export const glossaryOf = (courseId: string) => entriesOf('glossary', courseId);
export const servicesOf = (courseId: string) => entriesOf('services', courseId);

/** The lesson entry for a course day (or undefined when the day has no MDX yet). */
export async function lessonOfDay(courseId: string, day: number): Promise<CourseEntry<'lessons'> | undefined> {
  return (await lessonsOf(courseId)).find((l) => l.data.day === day);
}

/** A course's questions of one set (`day-NN`, `week-N`, `mock-N`), in file order. */
export async function questionSetOf(courseId: string, set: string): Promise<CourseEntry<'questions'>[]> {
  return (await questionsOf(courseId)).filter((q) => q.data.set === set);
}
