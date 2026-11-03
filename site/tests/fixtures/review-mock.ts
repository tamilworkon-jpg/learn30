// Test-only question fixtures for the weekly review and mock exam UI (T079, T086). Never part of the question bank:
// they are rendered only by the non-learner routes under /design/fixture-*.
import type { DomainId, Question } from '../../src/lib/types';

const opts = (n: number) => [
  { id: 'a', text: `Correct answer ${n}`, explanation: 'This is the right option for the fixture.' },
  { id: 'b', text: `Distractor B ${n}`, explanation: 'Wrong option in the fixture.' },
  { id: 'c', text: `Distractor C ${n}`, explanation: 'Wrong option in the fixture.' },
  { id: 'd', text: `Distractor D ${n}`, explanation: 'Wrong option in the fixture.' },
];

const TS: Record<DomainId, string> = { D1: '1.1', D2: '2.1', D3: '3.1', D4: '4.1', D5: '5.1' };

function single(set: string, n: number, domain: DomainId, lessonRef: string): Question {
  return {
    id: `q-${set}-${String(n).padStart(3, '0')}`,
    set,
    type: 'single',
    stem: `Fixture question ${n}: which option is correct?`,
    options: opts(n),
    answer: ['a'],
    explanation: `Fixture explanation for question ${n}: option A is always correct.`,
    domain,
    taskStatement: TS[domain],
    lessonRef,
    difficulty: 'easy',
  };
}

/** Module 1 fixture: 8 single-answer questions (D1 × 6 across Days 1–3, D4 × 2 on Day 2). Correct option is always "a". */
export const weekFixture: Question[] = [
  single('week-1', 1, 'D1', 'day-01#explanation'),
  single('week-1', 2, 'D1', 'day-01#examples'),
  single('week-1', 3, 'D1', 'day-02#explanation'),
  single('week-1', 4, 'D1', 'day-03#explanation'),
  single('week-1', 5, 'D1', 'day-03#examples'),
  single('week-1', 6, 'D1', 'day-01#summary'),
  single('week-1', 7, 'D4', 'day-02#explanation'),
  single('week-1', 8, 'D4', 'day-02#exam-tips'),
];

const SPLIT: [DomainId, number, string][] = [
  ['D1', 13, 'day-01#explanation'],
  ['D2', 16, 'day-02#explanation'],
  ['D3', 18, 'day-03#explanation'],
  ['D4', 9, 'day-02#exam-tips'],
  ['D5', 9, 'day-03#examples'],
];

/** Mock fixture: exactly 65 questions with the official 13/16/18/9/9 split; Q2 multi, Q3 ordering, Q4 matching, rest single ("a"). */
export const mockFixture: Question[] = (() => {
  const out: Question[] = [];
  for (const [domain, count, ref] of SPLIT)
    for (let i = 0; i < count; i++) out.push(single('mock-1', out.length + 1, domain, ref));
  const q2 = out[1];
  out[1] = {
    ...q2,
    type: 'multi',
    stem: 'Fixture question 2: which TWO options are correct? (Select TWO.)',
    options: [
      ...opts(2),
      { id: 'e', text: 'Correct answer 2 (second)', explanation: 'Also right in the fixture.' },
    ],
    answer: ['a', 'e'],
  };
  out[2] = {
    ...out[2],
    type: 'ordering',
    stem: 'Fixture question 3: put the steps in order.',
    options: opts(3).slice(0, 3),
    answer: ['a', 'b', 'c'],
  };
  out[3] = {
    ...out[3],
    type: 'matching',
    stem: 'Fixture question 4: match each item to its target.',
    options: opts(4).slice(0, 3),
    matchTargets: [
      { id: 't1', text: 'Target one' },
      { id: 't2', text: 'Target two' },
      { id: 't3', text: 'Target three' },
    ],
    answer: { a: 't1', b: 't2', c: 't3' },
  };
  return out;
})();
