import { describe, expect, it } from 'vitest';
import { validateLesson, validateQuestion } from '../../src/schemas';
import { lessonZod, questionZod } from '../../src/schemas/zod';

const opt = (id: string) => ({ id, text: `Option ${id}`, explanation: `Why ${id} is right or wrong` });
const baseQ = {
  id: 'q-day-01-001',
  set: 'day-01',
  stem: 'Which statement best describes machine learning?',
  explanation: 'Machine learning learns patterns from data.',
  domain: 'D1',
  taskStatement: '1.1',
  lessonRef: 'day-01#explanation',
  difficulty: 'easy',
};

const questionCases: [string, unknown, boolean][] = [
  ['single valid', { ...baseQ, type: 'single', options: ['a', 'b', 'c', 'd'].map(opt), answer: ['a'] }, true],
  ['single with 3 options', { ...baseQ, type: 'single', options: ['a', 'b', 'c'].map(opt), answer: ['a'] }, false],
  ['single with 2 answers', { ...baseQ, type: 'single', options: ['a', 'b', 'c', 'd'].map(opt), answer: ['a', 'b'] }, false],
  ['multi valid', { ...baseQ, type: 'multi', options: ['a', 'b', 'c', 'd', 'e'].map(opt), answer: ['a', 'b'] }, true],
  ['multi 1 answer', { ...baseQ, type: 'multi', options: ['a', 'b', 'c', 'd', 'e'].map(opt), answer: ['a'] }, false],
  ['multi 4 options', { ...baseQ, type: 'multi', options: ['a', 'b', 'c', 'd'].map(opt), answer: ['a', 'b'] }, false],
  ['ordering valid', { ...baseQ, type: 'ordering', options: ['a', 'b', 'c'].map(opt), answer: ['b', 'a', 'c'] }, true],
  ['ordering 6 items', { ...baseQ, type: 'ordering', options: ['a', 'b', 'c', 'd', 'e', 'f'].map(opt), answer: ['a'] }, false],
  [
    'matching valid',
    { ...baseQ, type: 'matching', options: ['a', 'b', 'c'].map(opt), matchTargets: [{ id: 'x', text: 'X' }, { id: 'y', text: 'Y' }, { id: 'z', text: 'Z' }], answer: { a: 'x', b: 'y', c: 'z' } },
    true,
  ],
  ['matching without targets', { ...baseQ, type: 'matching', options: ['a', 'b', 'c'].map(opt), answer: { a: 'x' } }, false],
  ['bad id', { ...baseQ, id: 'question-1', type: 'single', options: ['a', 'b', 'c', 'd'].map(opt), answer: ['a'] }, false],
  ['bad lessonRef', { ...baseQ, lessonRef: 'day-1', type: 'single', options: ['a', 'b', 'c', 'd'].map(opt), answer: ['a'] }, false],
  [
    'option without explanation',
    { ...baseQ, type: 'single', options: [{ id: 'a', text: 'A' }, opt('b'), opt('c'), opt('d')], answer: ['a'] },
    false,
  ],
];

const baseLesson = {
  day: 2,
  kind: 'lesson',
  title: 'ML vocabulary',
  summary: 'Short summary.',
  domains: ['D1'],
  taskStatements: ['1.1'],
  sources: [{ provider: 'skillbuilder', title: 'Fundamentals of ML and AI' }],
  objectives: ['a', 'b', 'c'],
  estimatedMinutes: 60,
  deepDiveMinutes: 15,
  lastVerified: '2026-11-02',
};

const { sources: _s, deepDiveMinutes: _d, ...reviewBase } = baseLesson;

const lessonCases: [string, unknown, boolean][] = [
  ['lesson valid', baseLesson, true],
  ['lesson 80 minutes', { ...baseLesson, estimatedMinutes: 80 }, false],
  ['lesson without sources', { ...baseLesson, sources: [] }, false],
  ['lesson 2 objectives', { ...baseLesson, objectives: ['a', 'b'] }, false],
  ['review 40 minutes', { ...reviewBase, kind: 'review', estimatedMinutes: 40 }, true],
  ['bad task statement', { ...baseLesson, taskStatements: ['6.1'] }, false],
  ['duplicate domains', { ...baseLesson, domains: ['D1', 'D1'] }, false],
  ['impossible date', { ...baseLesson, lastVerified: '2026-99-99' }, false],
];

describe('question schema (T013 F6–F8)', () => {
  for (const [name, data, ok] of questionCases) {
    it(`${name} → ${ok ? 'valid' : 'invalid'}`, () => expect(validateQuestion(data)).toBe(ok));
    it(`F10 Zod parity: ${name}`, () => expect(questionZod.safeParse(data).success).toBe(ok));
  }
});

describe('lesson schema (T013 F9)', () => {
  for (const [name, data, ok] of lessonCases) {
    it(`${name} → ${ok ? 'valid' : 'invalid'}`, () => expect(validateLesson(data)).toBe(ok));
    it(`F10 Zod parity: ${name}`, () => expect(lessonZod.safeParse(data).success).toBe(ok));
  }
});
