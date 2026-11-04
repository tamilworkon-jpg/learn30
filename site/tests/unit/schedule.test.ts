import { describe, expect, it } from 'vitest';
import { COURSE_DAYS, finishDate, projectedFinish, studyWeekDays, studyWeeks, isStudyDay, localDay, nextStudyDay, planDayOn, plannedDate, scheduleStatus, toDateInput, fromDateInput } from '../../src/lib/schedule';

// T183 SD1 — schedule maths in the browser's local time zone.
const d = (y: number, m: number, day: number, h = 12) => new Date(y, m - 1, day, h);

describe('schedule (T183, weekdays only)', () => {
  const ld = (y: number, m: number, day: number) => localDay(d(y, m, day));
  it('SD1 Day N = N-th weekday from the start; 30 days = 6 calendar weeks', () => {
    const start = d(2026, 11, 2, 18); // Monday
    expect(localDay(plannedDate(start, 1))).toEqual(ld(2026, 11, 2));
    expect(localDay(plannedDate(start, 5))).toEqual(ld(2026, 11, 6)); // Friday
    expect(localDay(plannedDate(start, 6))).toEqual(ld(2026, 11, 9)); // next Monday, weekend skipped
    expect(localDay(plannedDate(start, 30))).toEqual(ld(2026, 12, 11)); // Friday of week 6
    expect(localDay(finishDate(start))).toEqual(ld(2026, 12, 11));
    expect(COURSE_DAYS).toBe(30);
    for (let n = 1; n <= 30; n++) expect(isStudyDay(plannedDate(start, n))).toBe(true);
  });

  it('SD1 a weekend or mid-week start', () => {
    expect(localDay(plannedDate(d(2026, 11, 7), 1))).toEqual(ld(2026, 11, 9)); // Saturday → Monday
    expect(localDay(nextStudyDay(d(2026, 11, 8)))).toEqual(ld(2026, 11, 9)); // Sunday → Monday
    const wed = d(2026, 11, 4);
    expect(localDay(plannedDate(wed, 3))).toEqual(ld(2026, 11, 6)); // Fri
    expect(localDay(plannedDate(wed, 4))).toEqual(ld(2026, 11, 9)); // Mon
    expect(localDay(plannedDate(wed, 30))).toEqual(ld(2026, 12, 15));
  });

  it('SD1 month/year and DST boundaries count calendar days, not 24 h blocks', () => {
    expect(localDay(plannedDate(d(2026, 12, 21), 10))).toEqual(ld(2027, 1, 1)); // Mon 21 Dec + 9 weekdays
    expect(localDay(plannedDate(d(2027, 3, 22), 11))).toEqual(ld(2027, 4, 5));
    expect(localDay(plannedDate(d(2026, 10, 19), 11))).toEqual(ld(2026, 11, 2));
  });

  it('SD1 plan day for a given date; weekends name the coming Monday', () => {
    const start = d(2026, 11, 2, 23);
    expect(planDayOn(start, d(2026, 11, 2, 1))).toBe(1);
    expect(planDayOn(start, d(2026, 11, 6, 9))).toBe(5);
    expect(planDayOn(start, d(2026, 11, 7))).toBe(6); // Saturday → Monday's day
    expect(planDayOn(start, d(2026, 11, 9))).toBe(6);
    expect(planDayOn(start, d(2026, 11, 1))).toBe(0); // Sunday before the start
    expect(planDayOn(start, d(2026, 10, 30))).toBe(-1); // Friday before
    expect(planDayOn(start, d(2026, 12, 14))).toBe(31); // past the finish date
    for (let n = 1; n <= 30; n++) expect(planDayOn(start, plannedDate(start, n))).toBe(n);
    expect(planDayOn(d(2026, 11, 7), d(2026, 11, 8))).toBeLessThanOrEqual(0); // weekend start: not started until Monday
  });

  it('SD1 ahead / on track / behind by completed days vs plan', () => {
    const start = d(2026, 11, 2);
    const today = d(2026, 11, 6); // plan Day 5 → 4 days should be done before today
    expect(scheduleStatus(start, today, 4)).toEqual({ planDay: 5, expectedDone: 4, delta: 0, state: 'on-track' });
    expect(scheduleStatus(start, today, 6)).toMatchObject({ delta: 2, state: 'ahead' });
    expect(scheduleStatus(start, today, 1)).toMatchObject({ delta: -3, state: 'behind' });
    expect(scheduleStatus(start, d(2026, 11, 8), 5)).toMatchObject({ planDay: 6, expectedDone: 5, state: 'on-track' }); // Sunday
    expect(scheduleStatus(start, d(2027, 1, 20), 30)).toMatchObject({ expectedDone: 30, state: 'on-track' });
    expect(scheduleStatus(start, d(2026, 11, 1), 0)).toMatchObject({ planDay: 0, expectedDone: 0, state: 'not-started' });
  });

  it('projected finish moves the original finish by the lag (weekdays)', () => {
    const start = d(2026, 11, 2); // original finish Fri 11 Dec
    const fri = d(2026, 11, 6); // plan Day 5 → 4 should be done
    expect(localDay(projectedFinish(start, fri, 4)!)).toEqual(localDay(d(2026, 12, 11))); // on track
    expect(localDay(projectedFinish(start, fri, 2)!)).toEqual(localDay(d(2026, 12, 15))); // 2 behind → Tue
    expect(localDay(projectedFinish(start, fri, 5)!)).toEqual(localDay(d(2026, 12, 10))); // 1 ahead → Thu
    expect(localDay(projectedFinish(start, d(2026, 10, 30), 0)!)).toEqual(localDay(d(2026, 12, 11))); // not started
    expect(projectedFinish(start, fri, 30)).toBeNull();
  });

  it('Learn30: a 3-day course finishes on its 3rd weekday, in one study week (per-course length)', () => {
    const mon = d(2026, 11, 2);
    expect(localDay(finishDate(mon, 3))).toEqual(localDay(d(2026, 11, 4))); // Wed
    expect(localDay(finishDate(d(2026, 11, 5), 3))).toEqual(localDay(d(2026, 11, 9))); // Thu start → Mon
    expect(studyWeeks(3)).toBe(1);
    expect(studyWeeks()).toBe(6); // AWS default unchanged
    expect(studyWeekDays(1, 3)).toEqual([1, 2, 3]);
    expect(studyWeekDays(1)).toEqual([1, 2, 3, 4, 5]);
    // Day 3 of 3 done → finished; 1 done on Wed (Day 3 planned) → 1 behind → finish Thu
    expect(projectedFinish(mon, d(2026, 11, 4), 3, 3)).toBeNull();
    expect(localDay(projectedFinish(mon, d(2026, 11, 4), 1, 3)!)).toEqual(localDay(d(2026, 11, 5)));
    expect(scheduleStatus(mon, d(2026, 11, 20), 0, 3)).toMatchObject({ expectedDone: 3, state: 'behind' });
  });

  it('date input helpers round-trip local dates', () => {
    expect(toDateInput(d(2026, 3, 7, 23))).toBe('2026-03-07');
    const back = fromDateInput('2026-03-07');
    expect([back.getFullYear(), back.getMonth(), back.getDate(), back.getHours()]).toEqual([2026, 2, 7, 0]);
    expect(() => fromDateInput('2026-13-40')).toThrow();
  });
});
