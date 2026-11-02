import { beforeEach, describe, expect, it } from 'vitest';
import { createStore, STORAGE_KEY } from '../../src/lib/progress/store';
import { validateProgress } from '../../src/schemas';

describe('progress store (T016)', () => {
  beforeEach(() => localStorage.clear());

  it('F29 default state is schema-valid and uses key aip-course:v1', () => {
    const s = createStore();
    expect(STORAGE_KEY).toBe('aip-course:v1');
    expect(validateProgress(s.get())).toBe(true);
    s.setLastPosition(1, 'objectives');
    expect(localStorage.getItem('aip-course:v1')).toContain('objectives');
  });

  it('F30 corrupt JSON recovers with backup', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    const s = createStore();
    expect(s.recovered).toBe(true);
    expect(localStorage.getItem('aip-course:v1:backup')).toBe('{not json');
    expect(validateProgress(s.get())).toBe(true);
  });

  it('F31 mutations', () => {
    const s = createStore();
    s.markSectionViewed(3, 'recap');
    s.markSectionViewed(3, 'recap');
    expect(s.get().days['3'].sectionsViewed).toEqual(['recap']);
    expect(s.get().days['3'].status).toBe('in-progress');
    s.markDayComplete(3);
    expect(s.get().days['3'].status).toBe('completed');
    s.unmarkDay(3);
    expect(s.get().days['3'].status).toBe('in-progress');
    s.saveInProgress('day-03', { answers: { q1: ['a'] }, flagged: [] });
    expect(s.get().inProgress['day-03'].answers).toEqual({ q1: ['a'] });
    s.recordAttempt({
      assessmentId: 'day-03', kind: 'daily', answers: {}, flagged: [], startedAt: new Date().toISOString(),
      score: { correct: 5, total: 10, percent: 50 }, byDomain: {}, autoSubmitted: false,
    });
    s.recordAttempt({
      assessmentId: 'day-03', kind: 'daily', answers: {}, flagged: [], startedAt: new Date().toISOString(),
      score: { correct: 3, total: 10, percent: 30 }, byDomain: {}, autoSubmitted: false,
    });
    expect(s.get().days['3'].bestScore).toBe(50);
    expect(s.get().days['3'].latestScore).toBe(30);
    expect(s.get().inProgress['day-03']).toBeUndefined();
    s.setRating('week-1', 5);
    expect(s.get().ratings['week-1']).toBe(5);
    expect(() => s.setRating('week-1', 9)).toThrow();
    expect(validateProgress(s.get())).toBe(true);
    s.reset();
    expect(s.get().attempts).toEqual([]);
  });

  it('F30b stored progress without optional ratings still accepts ratings', () => {
    const { ratings: _r, ...old } = createStore().get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
    const s = createStore();
    s.setRating('week-2', 4);
    expect(s.get().ratings['week-2']).toBe(4);
  });

  it('F32 attempts are capped at 500', () => {
    const s = createStore();
    for (let i = 0; i < 505; i++) {
      s.recordAttempt({
        assessmentId: 'day-01', kind: 'daily', answers: {}, flagged: [], startedAt: new Date().toISOString(),
        score: { correct: i % 10, total: 10, percent: (i % 10) * 10 }, byDomain: {}, autoSubmitted: false,
      });
    }
    expect(s.get().attempts).toHaveLength(500);
  });

  it('storage that throws (blocked or full) never breaks the app; progress stays in memory', () => {
    const blocked = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('QuotaExceededError'); }, removeItem() {}, clear() {}, key: () => null, length: 0 } as Storage;
    const s = createStore(blocked);
    expect(s.persistent).toBe(false);
    expect(() => s.markDayComplete(1)).not.toThrow();
    expect(s.get().days['1'].status).toBe('completed');
    const none = createStore(null);
    expect(none.persistent).toBe(false);
    expect(() => none.setLastPosition(2, 'recap')).not.toThrow();
  });

  it('a second recovery keeps the first backup', () => {
    localStorage.setItem(STORAGE_KEY, '{first bad');
    createStore();
    localStorage.setItem(STORAGE_KEY, '{second bad');
    createStore();
    expect(localStorage.getItem('aip-course:v1:backup')).toBe('{first bad');
  });
});
