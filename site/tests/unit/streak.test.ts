import { describe, expect, it } from 'vitest';
import { BADGES, earnedBadges, newBadges, weeksFromCourse } from '../../src/lib/badges';
import { course } from '../../src/lib/data';
import { defaultProgress } from '../../src/lib/progress/store';
import { currentStreak, localDate, recordStudyDay } from '../../src/lib/streak';
import type { Attempt, Progress } from '../../src/lib/types';

// T106 — streaks and badges.
describe('streak (T106)', () => {
  it('E1 consecutive dates increment', () => {
    let s = recordStudyDay({ current: 0, longest: 0 }, '2026-11-01');
    expect(s).toEqual({ current: 1, longest: 1, lastStudyDate: '2026-11-01' });
    s = recordStudyDay(s, '2026-11-02');
    s = recordStudyDay(s, '2026-11-03');
    expect(s).toEqual({ current: 3, longest: 3, lastStudyDate: '2026-11-03' });
  });

  it('E1 increments across month and year boundaries', () => {
    expect(recordStudyDay({ current: 4, longest: 4, lastStudyDate: '2026-10-31' }, '2026-11-01').current).toBe(5);
    expect(recordStudyDay({ current: 2, longest: 2, lastStudyDate: '2026-12-31' }, '2027-01-01').current).toBe(3);
  });

  it('E2 a gap resets current but keeps longest', () => {
    const s = recordStudyDay({ current: 5, longest: 5, lastStudyDate: '2026-11-01' }, '2026-11-03');
    expect(s).toEqual({ current: 1, longest: 5, lastStudyDate: '2026-11-03' });
  });

  it('E3 the same day is not double counted', () => {
    const a = recordStudyDay({ current: 2, longest: 4, lastStudyDate: '2026-11-02' }, '2026-11-02');
    expect(a).toEqual({ current: 2, longest: 4, lastStudyDate: '2026-11-02' });
  });

  it('displayed streak is 0 once a whole day has been missed', () => {
    const s = { current: 3, longest: 3, lastStudyDate: '2026-11-02' };
    expect(currentStreak(s, '2026-11-02')).toBe(3);
    expect(currentStreak(s, '2026-11-03')).toBe(3);
    expect(currentStreak(s, '2026-11-04')).toBe(0);
    expect(currentStreak({ current: 0, longest: 0 }, '2026-11-04')).toBe(0);
  });

  it('localDate formats the local calendar date', () => {
    expect(localDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('store.markDayComplete updates the streak', async () => {
    localStorage.clear();
    const { createStore } = await import('../../src/lib/progress/store');
    const st = createStore();
    st.markDayComplete(1);
    st.markDayComplete(2);
    expect(st.get().streak).toEqual({ current: 1, longest: 1, lastStudyDate: localDate() });
  });
});

const weeks = weeksFromCourse(course);
const total = course.days.length;
const withDays = (n: number[], extra: Partial<Progress> = {}): Progress => {
  const p = defaultProgress();
  for (const d of n) p.days[String(d)] = { status: 'completed', sectionsViewed: [] };
  return { ...p, ...extra };
};
const mock = (scaled: number): Attempt => ({
  id: `mock-1-${scaled}`,
  assessmentId: 'mock-1',
  kind: 'mock',
  startedAt: '2026-11-01T10:00:00Z',
  submittedAt: '2026-11-01T11:30:00Z',
  answers: {},
  flagged: [],
  score: { correct: 50, total: 65, percent: 76.92, scaled },
  byDomain: {},
  autoSubmitted: false,
});

describe('badges (T106 E4)', () => {
  it('every course.yaml badge has display metadata', () => {
    for (const id of course.badges) expect(BADGES[id], id).toBeDefined();
  });

  it('week completion', () => {
    expect(earnedBadges(withDays([1, 2, 3, 4, 5, 6]), weeks, total)).toEqual([]);
    expect(earnedBadges(withDays([1, 2, 3, 4, 5, 6, 7]), weeks, total)).toEqual(['week-1']);
    expect(earnedBadges(withDays([8, 9, 10, 11, 12, 13, 14]), weeks, total)).toEqual(['week-2']);
  });

  it('mock pass at scaled ≥ 700 only', () => {
    expect(earnedBadges(withDays([], { attempts: [mock(690)] }), weeks, total)).toEqual([]);
    expect(earnedBadges(withDays([], { attempts: [mock(700)] }), weeks, total)).toEqual(['mock-pass']);
  });

  it('streak 7 from the longest streak', () => {
    expect(earnedBadges(withDays([], { streak: { current: 6, longest: 6 } }), weeks, total)).toEqual([]);
    expect(earnedBadges(withDays([], { streak: { current: 1, longest: 7 } }), weeks, total)).toEqual(['streak-7']);
  });

  it('course complete needs all 30 days', () => {
    const all = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(earnedBadges(withDays(all.slice(0, 29)), weeks, total)).not.toContain('course-complete');
    expect(earnedBadges(withDays(all), weeks, total)).toEqual(['week-1', 'week-2', 'week-3', 'week-4', 'course-complete']);
  });

  it('newBadges lists only badges not held before', () => {
    expect(newBadges(['week-1'], ['week-1', 'streak-7'])).toEqual(['streak-7']);
  });

  it('store.awardBadges keeps earned badges (union, no duplicates)', async () => {
    localStorage.clear();
    const { createStore } = await import('../../src/lib/progress/store');
    const st = createStore();
    st.awardBadges(['week-1']);
    st.awardBadges(['week-1', 'streak-7']);
    expect(st.get().badges).toEqual(['week-1', 'streak-7']);
  });
});
