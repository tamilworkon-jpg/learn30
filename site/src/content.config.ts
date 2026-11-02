import { readdir, readFile } from 'node:fs/promises';
import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { load } from 'js-yaml';
import { lessonZod, questionZod } from './schemas/zod';
import { glossaryZod, serviceZod, slugify } from './schemas/lookup';

const lessons = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/lessons' }),
  schema: lessonZod,
});

// Each questions/*.yaml file is an array of questions (one set); store one entry per question.
const QUESTIONS_DIR = new URL('./content/questions/', import.meta.url);
const questionSets: Loader = {
  name: 'question-sets',
  async load({ store, parseData, watcher, logger }) {
    const sync = async () => {
      store.clear();
      const files = (await readdir(QUESTIONS_DIR).catch(() => [] as string[])).filter((f) => f.endsWith('.yaml'));
      for (const file of files) {
        const items = load(await readFile(new URL(file, QUESTIONS_DIR), 'utf8'));
        if (!Array.isArray(items)) throw new Error(`questions/${file} must be a YAML array`);
        for (const raw of items as { id: string }[]) {
          const data = await parseData({ id: raw.id, data: raw as Record<string, unknown> });
          store.set({ id: raw.id, data });
        }
      }
      logger.info(`loaded ${store.keys().length} questions from ${files.length} sets`);
    };
    await sync();
    watcher?.on('change', (p) => p.includes('content/questions') && sync());
    watcher?.on('add', (p) => p.includes('content/questions') && sync());
  },
};

const questions = defineCollection({ loader: questionSets, schema: questionZod });

// US6 lookup content: each glossary/*.yaml and services/*.yaml file is an array; one entry per term / service card.
function yamlArrayLoader(dir: string, idOf: (raw: Record<string, unknown>) => string): Loader {
  const base = new URL(`./content/${dir}/`, import.meta.url);
  return {
    name: `${dir}-yaml`,
    async load({ store, parseData, watcher, logger }) {
      const sync = async () => {
        store.clear();
        const files = (await readdir(base).catch(() => [] as string[])).filter((f) => f.endsWith('.yaml'));
        for (const file of files) {
          const items = load(await readFile(new URL(file, base), 'utf8'));
          if (!Array.isArray(items)) throw new Error(`${dir}/${file} must be a YAML array`);
          for (const raw of items as Record<string, unknown>[]) {
            const id = idOf(raw);
            store.set({ id, data: await parseData({ id, data: raw }) });
          }
        }
        logger.info(`loaded ${store.keys().length} ${dir} entries from ${files.length} files`);
      };
      await sync();
      watcher?.on('change', (p) => p.includes(`content/${dir}`) && sync());
      watcher?.on('add', (p) => p.includes(`content/${dir}`) && sync());
    },
  };
}

const glossary = defineCollection({ loader: yamlArrayLoader('glossary', (r) => slugify(String(r.term))), schema: glossaryZod });
const services = defineCollection({ loader: yamlArrayLoader('services', (r) => slugify(String(r.name))), schema: serviceZod });

export const collections = { lessons, questions, glossary, services };
