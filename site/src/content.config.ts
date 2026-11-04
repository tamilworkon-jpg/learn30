// Learn30 (spec 002, contracts/course-folder.md): every collection is split by course —
// src/content/<collection>/<courseId>/… — and entry ids are `<courseId>/<local id>`. Read entries through
// src/lib/course-content.ts (lessonsOf/questionsOf/glossaryOf/servicesOf), which filter by course and
// expose `courseId` + `localId`. Test-only fixture courses (tests/fixtures/courses/<id>/content/<collection>/)
// are added when AIP_FIXTURE_COURSES=1 (e2e builds).
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { load } from 'js-yaml';
import { lessonZod, questionZod } from './schemas/zod';
import { glossaryZod, serviceZod, slugify } from './schemas/lookup';

const FIXTURES = process.env.AIP_FIXTURE_COURSES === '1';
const ROOT = new URL('../', import.meta.url);
const FIXTURE_ROOT = new URL('tests/fixtures/courses/', ROOT);

/** Lessons: src/content/lessons/<course>/day-NN.mdx (+ fixtures) → id `<course>/day-NN`. */
const lessons = defineCollection({
  loader: glob({
    base: './',
    pattern: ['src/content/lessons/*/*.mdx', ...(FIXTURES ? ['tests/fixtures/courses/*/content/lessons/*.mdx'] : [])],
    generateId: ({ entry }) => {
      const m = /^(?:src\/content\/lessons\/|tests\/fixtures\/courses\/)([a-z0-9-]+)\/(?:content\/lessons\/)?([^/]+)\.mdx$/.exec(entry.replace(/\\/g, '/'));
      return m ? `${m[1]}/${m[2]}` : entry;
    },
  }),
  schema: lessonZod,
});

/** <collection> folder per course: real courses first, then fixture courses (e2e builds only). */
async function courseDirs(collection: string): Promise<{ courseId: string; dir: URL }[]> {
  const out: { courseId: string; dir: URL }[] = [];
  const realBase = new URL(`src/content/${collection}/`, ROOT);
  for (const id of await readdir(realBase).catch(() => [] as string[])) if (/^[a-z0-9-]+$/.test(id)) out.push({ courseId: id, dir: new URL(`${id}/`, realBase) });
  if (FIXTURES && existsSync(FIXTURE_ROOT)) {
    for (const id of await readdir(FIXTURE_ROOT).catch(() => [] as string[])) {
      const dir = new URL(`${id}/content/${collection}/`, FIXTURE_ROOT);
      if (/^[a-z0-9-]+$/.test(id) && existsSync(dir)) out.push({ courseId: id, dir });
    }
  }
  return out;
}

/** Each <collection>/<course>/*.yaml file is an array; one entry per item, id `<course>/<idOf(item)>`. */
function courseYamlLoader(collection: string, idOf: (raw: Record<string, unknown>) => string): Loader {
  return {
    name: `${collection}-yaml`,
    async load({ store, parseData, watcher, logger }) {
      const sync = async () => {
        store.clear();
        let files = 0;
        for (const { courseId, dir } of await courseDirs(collection)) {
          for (const file of (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.yaml'))) {
            files++;
            const items = load(await readFile(new URL(file, dir), 'utf8'));
            if (!Array.isArray(items)) throw new Error(`${collection}/${courseId}/${file} must be a YAML array`);
            for (const raw of items as Record<string, unknown>[]) {
              const id = `${courseId}/${idOf(raw)}`;
              store.set({ id, data: await parseData({ id, data: raw }) });
            }
          }
        }
        logger.info(`loaded ${store.keys().length} ${collection} entries from ${files} files`);
      };
      await sync();
      const mine = (p: string) => p.replace(/\\/g, '/').includes(`content/${collection}`);
      watcher?.on('change', (p) => mine(p) && sync());
      watcher?.on('add', (p) => mine(p) && sync());
    },
  };
}

const questions = defineCollection({ loader: courseYamlLoader('questions', (r) => String(r.id)), schema: questionZod });
const glossary = defineCollection({ loader: courseYamlLoader('glossary', (r) => slugify(String(r.term))), schema: glossaryZod });
const services = defineCollection({ loader: courseYamlLoader('services', (r) => slugify(String(r.name))), schema: serviceZod });

export const collections = { lessons, questions, glossary, services };
