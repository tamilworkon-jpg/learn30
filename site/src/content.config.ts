import { readdir, readFile } from 'node:fs/promises';
import { defineCollection } from 'astro:content';
import { glob, type Loader } from 'astro/loaders';
import { load } from 'js-yaml';
import { lessonZod, questionZod } from './schemas/zod';

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

export const collections = { lessons, questions };
