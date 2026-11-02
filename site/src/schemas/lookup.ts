import { z } from 'astro/zod';

// Shapes for src/content/glossary/*.yaml and src/content/services/*.yaml (T103/T104, data-model.md).
const domain = z.enum(['D1', 'D2', 'D3', 'D4', 'D5']);
const ts = z.string().regex(/^[1-5]\.[1-4]$/);
/** `day-NN#section-id` for lessons that exist, or bare `day-NN` (the day page) for days still being written. */
export const lessonRef = z.string().regex(/^day-\d{2}(#[a-z0-9-]+)?$/);

export const glossaryZod = z.object({
  term: z.string().min(2),
  aliases: z.array(z.string()).optional(),
  definition: z.string().min(20).max(420),
  examCue: z.string().min(10).max(300),
  domain,
  taskStatements: z.array(ts).min(1),
  related: z.array(z.string()).optional(),
  lessonRefs: z.array(lessonRef).min(1),
});

export const SERVICE_CATEGORIES = [
  'AI services',
  'Generative AI & agents',
  'Analytics & data',
  'Compute',
  'Databases & vector stores',
  'Storage',
  'Security & identity',
  'Governance & monitoring',
  'Networking & delivery',
  'Cost management',
] as const;

export const serviceZod = z.object({
  name: z.string().min(2),
  aka: z.array(z.string()).optional(),
  category: z.enum(SERVICE_CATEGORIES),
  purpose: z.string().min(10).max(200),
  examCue: z.string().min(10).max(300),
  notThis: z.string().min(10).max(300),
  inScope: z.boolean(),
  taskStatements: z.array(ts).optional(),
  lessonRefs: z.array(lessonRef).min(1),
});

export type GlossaryTerm = z.infer<typeof glossaryZod>;
export type ServiceCard = z.infer<typeof serviceZod>;

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
