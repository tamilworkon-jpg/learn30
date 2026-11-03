import { beforeEach, describe, expect, it } from 'vitest';
import { createStore } from '../../src/lib/progress/store';
import { canSubmitAnswer, createQuizSession, displayOrder, isAnswered, requirement, unanswered } from '../../src/lib/quiz-state';
import { validateProgress } from '../../src/schemas';
import type { Question } from '../../src/lib/types';

const opt = (id: string) => ({ id, text: `Option ${id}`, explanation: `Because ${id}` });
const base = { set: 'day-02', explanation: 'An explanation long enough.', lessonRef: 'day-02#explanation', difficulty: 'easy' as const };
const questions: Question[] = [
  { ...base, id: 'q-day-02-001', type: 'single', stem: 'Single question stem', options: ['a', 'b', 'c', 'd'].map(opt), answer: ['b'], domain: 'D1', taskStatement: '1.1' },
  { ...base, id: 'q-day-02-002', type: 'multi', stem: 'Multi question stem', options: ['a', 'b', 'c', 'd', 'e'].map(opt), answer: ['a', 'c'], domain: 'D1', taskStatement: '1.1' },
  { ...base, id: 'q-day-02-003', type: 'ordering', stem: 'Ordering question stem', options: ['a', 'b', 'c', 'd'].map(opt), answer: ['a', 'b', 'c', 'd'], domain: 'D4', taskStatement: '4.1' },
  {
    ...base,
    id: 'q-day-02-004',
    type: 'matching',
    stem: 'Matching question stem',
    options: ['a', 'b', 'c'].map(opt),
    matchTargets: [
      { id: 't1', text: 'T1' },
      { id: 't2', text: 'T2' },
      { id: 't3', text: 'T3' },
    ],
    answer: { a: 't2', b: 't1', c: 't3' },
    domain: 'D4',
    taskStatement: '4.1',
  },
];

describe('quiz state (T049)', () => {
  beforeEach(() => localStorage.clear());

  it('Q-S1 answers persist to inProgress[assessmentId] and are restored by a new session', () => {
    const store = createStore();
    const s = createQuizSession(store, 'day-02', questions);
    s.answer('q-day-02-001', ['b']);
    s.answer('q-day-02-002', ['a', 'c']);
    expect(store.get().inProgress['day-02'].answers).toEqual({ 'q-day-02-001': ['b'], 'q-day-02-002': ['a', 'c'] });
    expect(validateProgress(store.get())).toBe(true);

    const again = createQuizSession(createStore(), 'day-02', questions);
    expect(again.answers()).toEqual({ 'q-day-02-001': ['b'], 'q-day-02-002': ['a', 'c'] });
  });

  it('Q-S1b submitted (locked) questions and the current question persist and are restored (learner feedback 2026-11-03)', () => {
    const store = createStore();
    const s = createQuizSession(store, 'day-02', questions);
    s.answer('q-day-02-001', ['b']);
    s.check('q-day-02-001');
    s.check('q-day-02-003', ['d', 'c', 'b', 'a']); // untouched ordering: answered with the shown order
    s.check('q-day-02-001'); // idempotent
    s.check('q-nope'); // unknown ids ignored
    s.setIndex(2);
    s.setIndex(99); // clamped to the last question
    const saved = store.get().inProgress['day-02'];
    expect(saved.checked).toEqual(['q-day-02-001', 'q-day-02-003']);
    expect(saved.index).toBe(3);
    expect(saved.answers['q-day-02-003']).toEqual(['d', 'c', 'b', 'a']);
    expect(validateProgress(store.get())).toBe(true);

    const again = createQuizSession(store, 'day-02', questions);
    expect(again.checked()).toEqual(['q-day-02-001', 'q-day-02-003']);
    expect(again.index()).toBe(3);

    // submitting clears them for the next attempt
    again.submit();
    expect(store.get().inProgress['day-02']).toBeUndefined();
    const fresh = createQuizSession(store, 'day-02', questions);
    expect([fresh.checked(), fresh.index(), fresh.attemptCount()]).toEqual([[], 0, 1]);
  });

  it('Q-S1c moving between questions before answering does not create an in-progress entry; older saves without checked/index stay valid', () => {
    const store = createStore();
    const s = createQuizSession(store, 'day-02', questions);
    s.setIndex(1);
    expect(store.get().inProgress['day-02']).toBeUndefined();
    store.saveInProgress('day-02', { answers: { 'q-day-02-001': ['b'] }, flagged: [] });
    expect(validateProgress(store.get())).toBe(true);
    const old = createQuizSession(store, 'day-02', questions);
    expect([old.checked(), old.index()]).toEqual([[], 0]);
  });

  it('answers to unknown questions are ignored; clearing removes the answer', () => {
    const store = createStore();
    const s = createQuizSession(store, 'day-02', questions);
    s.answer('q-day-99-001', ['a']);
    s.answer('q-day-02-002', ['a']);
    s.answer('q-day-02-002', []);
    expect(s.answers()).toEqual({});
  });

  it('isAnswered / unanswered per type', () => {
    expect(isAnswered(questions[0], undefined)).toBe(false);
    expect(isAnswered(questions[0], [])).toBe(false);
    expect(isAnswered(questions[0], ['a'])).toBe(true);
    expect(isAnswered(questions[2], ['d', 'c', 'b', 'a'])).toBe(true);
    expect(isAnswered(questions[3], { a: 't1' })).toBe(false); // partial matching
    expect(isAnswered(questions[3], { a: 't1', b: 't2', c: 't3' })).toBe(true);
    expect(unanswered(questions, { 'q-day-02-001': ['a'] }).map((q) => q.id)).toEqual(['q-day-02-002', 'q-day-02-003', 'q-day-02-004']);
  });

  it('ordering display order is deterministic and never already correct', () => {
    const q = questions[2];
    const order = displayOrder(q);
    expect(order).toEqual(displayOrder(q));
    expect([...order].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(order).not.toEqual(q.answer);
  });

  it('Q-S2 submit creates an Attempt with score + byDomain and clears inProgress', () => {
    const store = createStore();
    const s = createQuizSession(store, 'day-02', questions);
    s.answer('q-day-02-001', ['b']); // correct D1
    s.answer('q-day-02-002', ['a']); // wrong D1
    s.answer('q-day-02-004', { a: 't2', b: 't1', c: 't3' }); // correct D4; ordering unanswered → wrong
    const attempt = s.submit();
    expect(attempt.kind).toBe('daily');
    expect(attempt.assessmentId).toBe('day-02');
    expect(attempt.score).toEqual({ correct: 2, total: 4, percent: 50 });
    expect(attempt.byDomain).toEqual({ D1: { correct: 1, total: 2 }, D4: { correct: 1, total: 2 } });
    expect(attempt.autoSubmitted).toBe(false);
    expect(store.get().inProgress['day-02']).toBeUndefined();
    expect(store.get().attempts).toHaveLength(1);
    expect(validateProgress(store.get())).toBe(true);
  });

  it('Q-S3 DayState best/latest updated; best kept after a worse retake', () => {
    const store = createStore();
    const s = createQuizSession(store, 'day-02', questions);
    for (const q of questions) s.answer(q.id, q.answer);
    s.submit();
    expect(store.get().days['2']).toMatchObject({ bestScore: 100, latestScore: 100 });

    const retake = createQuizSession(store, 'day-02', questions);
    expect(retake.answers()).toEqual({});
    retake.answer('q-day-02-001', ['b']);
    retake.submit();
    expect(store.get().days['2']).toMatchObject({ bestScore: 100, latestScore: 25 });
    expect(retake.best()).toBe(100);
    expect(retake.lastAttempt()?.score.percent).toBe(25);
  });

  it('Q-S4 weekly assessment (week-N): kind weekly, best from attempts, no DayState change', () => {
    const store = createStore();
    const s = createQuizSession(store, 'week-1', questions, 'weekly');
    expect(s.best()).toBeUndefined();
    s.answer('q-day-02-001', ['b']);
    const a = s.submit();
    expect(a).toMatchObject({ assessmentId: 'week-1', kind: 'weekly' });
    expect(a.score.scaled).toBeUndefined();
    expect(a.byDomain).toEqual({ D1: { correct: 1, total: 2 }, D4: { correct: 0, total: 2 } });
    for (const q of questions) s.answer(q.id, q.answer);
    s.submit();
    expect(s.best()).toBe(100);
    expect(store.get().days).toEqual({});
    expect(validateProgress(store.get())).toBe(true);
  });

  it('requirement pill + per-question submit gating (learner feedback)', () => {
    const [single, multi, ordering, matching] = questions;
    expect(requirement(single).label).toBe('Single answer · choose 1');
    expect(requirement(multi)).toMatchObject({ need: 2, label: 'Multiple answers · choose 2' });
    expect(requirement(ordering).label).toBe('Put in order');
    expect(requirement(matching).label).toBe('Match each item');
    expect(canSubmitAnswer(single, undefined)).toBe(false);
    expect(canSubmitAnswer(single, ['a'])).toBe(true);
    expect(canSubmitAnswer(multi, ['a'])).toBe(false);
    expect(canSubmitAnswer(multi, ['a', 'b'])).toBe(true);
    expect(canSubmitAnswer(multi, ['a', 'b', 'c'])).toBe(false);
    expect(canSubmitAnswer(ordering, undefined)).toBe(true);
    expect(canSubmitAnswer(matching, { a: 't1' })).toBe(false);
    expect(canSubmitAnswer(matching, { a: 't1', b: 't2', c: 't3' })).toBe(true);
  });
});
