import { describe, expect, it } from 'vitest';
import { COURSE_DAYS, finishDate, localDay, planDayOn, plannedDate, scheduleStatus, toDateInput, fromDateInput } from '../../src/lib/schedule';

// T183 SD1 — schedule maths in the browser's local time zone.
const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

describe('schedule (T183)', () => {
  it('SD1 Day N = start + N − 1 calendar days; finish = start + 29', () => {
    const start = d(2026, 11, 2, 18);
    expect(localDay(plannedDate(start, 1))).toEqual(localDay(d(2026, 11, 2)));
    expect(localDay(plannedDate(start, 30))).toEqual(localDay(d(2026, 12, 1)));
    expect(localDay(finishDate(start))).toEqual(localDay(d(2026, 12, 1)));
    expect(COURSE_DAYS).toBe(30);
  });

  it('SD1 month/year and DST boundaries count calendar days, not 24 h blocks', () => {
    expect(localDay(plannedDate(d(2026, 12, 20), 13))).toEqual(localDay(d(2027, 1, 1)));
    // Late March / late October contain DST changes in many zones.
    expect(localDay(plannedDate(d(2027, 3, 20), 15))).toEqual(localDay(d(2027, 4, 3)));
    expect(localDay(plannedDate(d(2026, 10, 20), 15))).toEqual(localDay(d(2026, 11, 3)));
  });

  it('SD1 plan day for a given date (clamped info kept)', () => {
    const start = d(2026, 11, 2, 23);
    expect(planDayOn(start, d(2026, 11, 2, 1))).toBe(1);
    expect(planDayOn(start, d(2026, 11, 6, 9))).toBe(5);
    expect(planDayOn(start, d(2026, 11, 1))).toBe(0); // starts tomorrow
    expect(planDayOn(start, d(2026, 12, 10))).toBe(39); // past the finish date
  });

  it('SD1 ahead / on track / behind by completed days vs plan', () => {
    const start = d(2026, 11, 2);
    const today = d(2026, 11, 6); // plan Day 5 → 4 days should be done before today
    expect(scheduleStatus(start, today, 4)).toEqual({ planDay: 5, expectedDone: 4, delta: 0, state: 'on-track' });
    expect(scheduleStatus(start, today, 6)).toMatchObject({ delta: 2, state: 'ahead' });
    expect(scheduleStatus(start, today, 1)).toMatchObject({ delta: -3, state: 'behind' });
    expect(scheduleStatus(start, d(2026, 12, 20), 30)).toMatchObject({ planDay: 49, expectedDone: 30, state: 'on-track' });
    expect(scheduleStatus(start, d(2026, 11, 1), 0)).toMatchObject({ planDay: 0, expectedDone: 0, state: 'not-started' });
  });

  it('date input helpers round-trip local dates', () => {
    expect(toDateInput(d(2026, 3, 7, 23))).toBe('2026-03-07');
    const back = fromDateInput('2026-03-07');
    expect([back.getFullYear(), back.getMonth(), back.getDate(), back.getHours()]).toEqual([2026, 2, 7, 0]);
    expect(() => fromDateInput('2026-13-40')).toThrow();
  });
});
