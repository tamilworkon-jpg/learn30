import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { lessonZod } from './schemas/zod';

const lessons = defineCollection({
  loader: glob({ pattern: '*.mdx', base: './src/content/lessons' }),
  schema: lessonZod,
});

export const collections = { lessons };
