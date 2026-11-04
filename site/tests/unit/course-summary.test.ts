import { describe, expect, it } from 'vitest';
import { nextDayOf, parseSummary } from '../../src/lib/course-summary';

// Learn30 W4 — per-course summary from the page bootstrap (spec 002 contracts/progress-api-v2.md).
describe('course summary', () => {
  it('CS1 keeps well-formed course entries only; absent/malformed → null', () => {
    expect(parseSummary(undefined)).toBeNull();
    expect(parseSummary({ courses: 'x' })).toBeNull();
    const s = parseSummary({
      courses: {
        'aws-ai-practitioner': { completed: 3, startedAt: '2026-11-02T08:00:00.000Z', lastPosition: { day: 4, sectionId: 'quiz' }, updatedAt: '2026-11-04T08:00:00.000Z' },
        'demo-course': { completed: 'x', startedAt: '2026-11-02' },
        'Bad Id': { completed: 1, startedAt: '2026-11-02T08:00:00.000Z' },
        'no-date': { completed: 1, startedAt: 'never' },
      },
    });
    expect(Object.keys(s!)).toEqual(['aws-ai-practitioner']);
    expect(s!['aws-ai-practitioner']).toMatchObject({ completed: 3, lastPosition: { day: 4, sectionId: 'quiz' } });
  });

  it('CS2 next day: the unfinished last-opened day, else the first not done, capped at the course length', () => {
    const base = { startedAt: '2026-11-02T08:00:00.000Z' };
    expect(nextDayOf({ ...base, completed: 3, lastPosition: { day: 5 } }, 30)).toBe(5);
    expect(nextDayOf({ ...base, completed: 3, lastPosition: { day: 2 } }, 30)).toBe(4);
    expect(nextDayOf({ ...base, completed: 3, lastPosition: null }, 30)).toBe(4);
    expect(nextDayOf({ ...base, completed: 30, lastPosition: null }, 30)).toBe(30);
  });
});
