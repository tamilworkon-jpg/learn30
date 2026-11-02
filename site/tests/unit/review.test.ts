import { describe, expect, it } from 'vitest';
import { course, examGuide } from '../../src/lib/data';
import { domainRows, refDay, summaryByDomain, weeklySetId, weekOfDay } from '../../src/lib/review';
import type { Question } from '../../src/lib/types';

describe('weekly review helpers (T080/T081)', () => {
  it('maps review days to week-N sets and nothing else', () => {
    expect([7, 14, 21, 28].map((d) => weeklySetId(course, d))).toEqual([
      'week-1',
      'week-2',
      'week-3',
      'week-4',
    ]);
    expect(weeklySetId(course, 6)).toBeNull();
    expect(weeklySetId(course, 29)).toBeNull();
    expect(weekOfDay(course, 30)?.number).toBe(5);
  });

  it('W1 summary lists every prior lesson day grouped by domain', () => {
    const w1 = summaryByDomain(course, examGuide, 7);
    expect(w1.map((d) => d.id)).toEqual(['D1', 'D4']);
    expect(w1[0].days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(w1[1].days.map((d) => d.day)).toEqual([2]);
    expect(w1[1].days[0].taskStatements).toEqual(['4.1']);

    const w2 = summaryByDomain(course, examGuide, 14);
    const all = new Set(w2.flatMap((d) => d.days.map((x) => x.day)));
    expect([...all].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13]);
    expect(all.has(7)).toBe(false);

    const w4 = summaryByDomain(course, examGuide, 28);
    expect(w4.map((d) => d.id)).toEqual(['D1', 'D2', 'D3', 'D4', 'D5']);
  });

  it('W3 per-domain rows with weak flag and revisit days from missed questions', () => {
    const q = (id: string, domain: Question['domain'], ref: string): Question => ({
      id,
      set: 'week-1',
      type: 'single',
      stem: 'stem text here',
      options: [],
      answer: ['a'],
      explanation: '',
      domain,
      taskStatement: '1.1',
      lessonRef: ref,
      difficulty: 'easy',
    });
    const qs = [
      q('a', 'D1', 'day-02#x'),
      q('b', 'D1', 'day-05#x'),
      q('c', 'D1', 'day-02#y'),
      q('d', 'D4', 'day-02#z'),
    ];
    const rows = domainRows(
      {
        byDomain: { D1: { correct: 1, total: 3 }, D4: { correct: 1, total: 1 } },
        answers: { a: ['a'], b: ['b'], d: ['a'] },
      },
      qs,
    );
    expect(rows).toEqual([
      { id: 'D1', correct: 1, total: 3, percent: 33, weak: true, revisit: [2, 5] },
      { id: 'D4', correct: 1, total: 1, percent: 100, weak: false, revisit: [] },
    ]);
    expect(refDay('day-12#rag')).toBe(12);
    expect(refDay('nope')).toBe(0);
  });
});
