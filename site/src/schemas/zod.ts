import { z } from 'astro/zod';

const domain = z.enum(['D1', 'D2', 'D3', 'D4', 'D5']);
const ts = z.string().regex(/^[1-5]\.[1-4]$/);
const option = z.object({ id: z.string(), text: z.string(), explanation: z.string().min(5) });

export const questionZod = z
  .object({
    id: z.string().regex(/^q-(day-\d{2}|week-[1-4]|mock-[1-3])-\d{3}$/),
    set: z.string().regex(/^(day-\d{2}|week-[1-4]|mock-[1-3])$/),
    type: z.enum(['single', 'multi', 'ordering', 'matching']),
    stem: z.string().min(10),
    options: z.array(option),
    matchTargets: z.array(z.object({ id: z.string(), text: z.string() })).optional(),
    answer: z.union([z.array(z.string()), z.record(z.string())]),
    explanation: z.string().min(20),
    domain,
    taskStatement: ts,
    lessonRef: z.string().regex(/^day-\d{2}#[a-z0-9-]+$/),
    difficulty: z.enum(['easy', 'medium', 'hard']),
  })
  .superRefine((q, ctx) => {
    const n = q.options.length;
    const arr = Array.isArray(q.answer) ? q.answer : null;
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (q.type === 'single' && (n !== 4 || !arr || arr.length !== 1)) fail('single: options 4, answer 1');
    if (q.type === 'multi' && (n < 5 || !arr || arr.length < 2)) fail('multi: options >=5, answer >=2');
    if (q.type === 'ordering' && (n < 3 || n > 5)) fail('ordering: options 3-5');
    if (q.type === 'matching' && (n < 3 || n > 7 || !q.matchTargets || arr)) fail('matching: options 3-7 with matchTargets');
  });

export const lessonZod = z
  .object({
    day: z.number().int().min(1).max(30),
    kind: z.enum(['lesson', 'review', 'mock']),
    title: z.string().min(3),
    summary: z.string().max(900),
    domains: z.array(domain).min(1).refine((d) => new Set(d).size === d.length, 'domains must be unique'),
    taskStatements: z.array(ts).min(1),
    sources: z
      .array(z.object({ provider: z.enum(['udemy', 'skillbuilder', 'aws-docs']), title: z.string(), url: z.string().url().optional() }))
      .optional(),
    objectives: z.array(z.string()).min(3).max(7),
    estimatedMinutes: z.number().int().min(30).max(120),
    deepDiveMinutes: z.number().int().min(0).optional(),
    lastVerified: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((s) => {
        const d = new Date(`${s}T00:00:00Z`);
        return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
      }, 'invalid calendar date'),
    examTraps: z.array(z.string()).optional(),
    keyPoints: z.array(z.string()).min(3).max(8).optional(),
  })
  .superRefine((l, ctx) => {
    if (l.kind !== 'lesson') return;
    const fail = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    if (!l.sources || l.sources.length < 1) fail('lesson needs sources');
    if (l.deepDiveMinutes === undefined) fail('lesson needs deepDiveMinutes');
    if (l.estimatedMinutes < 50 || l.estimatedMinutes > 70) fail('lesson estimatedMinutes 50-70');
  });
