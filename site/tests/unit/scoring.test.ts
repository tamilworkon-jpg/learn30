import { describe, expect, it } from 'vitest';
import { byDomain, isPass, scoreAttempt, scoreQuestion, toScaled } from '../../src/lib/scoring';
import type { Question } from '../../src/lib/types';

const q = (over: Partial<Question>): Question => ({
  id: 'q-day-01-001',
  set: 'day-01',
  type: 'single',
  stem: 'stem text here',
  options: [
    { id: 'a', text: 'A', explanation: 'x' },
    { id: 'b', text: 'B', explanation: 'x' },
    { id: 'c', text: 'C', explanation: 'x' },
    { id: 'd', text: 'D', explanation: 'x' },
  ],
  answer: ['a'],
  explanation: 'because it is so, really',
  domain: 'D1',
  taskStatement: '1.1',
  lessonRef: 'day-01#explanation',
  difficulty: 'easy',
  ...over,
});

describe('scoring (T015)', () => {
  it('F21/F22/F23 percent, scaled and pass mark', () => {
    expect(toScaled(65, 65)).toBe(1000);
    expect(toScaled(0, 65)).toBe(100);
    expect(toScaled(44, 65)).toBe(Math.round(100 + (900 * 44) / 65));
    expect(isPass(700)).toBe(true);
    expect(isPass(699)).toBe(false);
  });

  it('F24 multi requires the exact set', () => {
    const m = q({ type: 'multi', answer: ['a', 'c'] });
    expect(scoreQuestion(m, ['c', 'a'])).toBe(true);
    expect(scoreQuestion(m, ['a'])).toBe(false);
    expect(scoreQuestion(m, ['a', 'b', 'c'])).toBe(false);
  });

  it('F25 ordering requires exact order', () => {
    const o = q({ type: 'ordering', answer: ['b', 'a', 'c'] });
    expect(scoreQuestion(o, ['b', 'a', 'c'])).toBe(true);
    expect(scoreQuestion(o, ['a', 'b', 'c'])).toBe(false);
  });

  it('F26 matching requires all pairs', () => {
    const m = q({ type: 'matching', answer: { a: 'x', b: 'y', c: 'z' } });
    expect(scoreQuestion(m, { a: 'x', b: 'y', c: 'z' })).toBe(true);
    expect(scoreQuestion(m, { a: 'x', b: 'z', c: 'y' })).toBe(false);
  });

  it('F27 unanswered is incorrect', () => {
    expect(scoreQuestion(q({}), undefined)).toBe(false);
  });

  it('F28 attempt score and byDomain totals', () => {
    const qs = [q({ id: 'q-day-01-001' }), q({ id: 'q-day-01-002', domain: 'D2' }), q({ id: 'q-day-01-003', domain: 'D2' })];
    const s = scoreAttempt(qs, { 'q-day-01-001': ['a'], 'q-day-01-002': ['b'] });
    expect(s.correct).toBe(1);
    expect(s.total).toBe(3);
    expect(s.percent).toBeCloseTo(33.33, 1);
    expect(byDomain(qs, { 'q-day-01-001': ['a'], 'q-day-01-002': ['b'] })).toEqual({
      D1: { correct: 1, total: 1 },
      D2: { correct: 0, total: 2 },
    });
  });
});
