// T183 — the learner's 30-day plan in the browser's local time zone. Study days are weekdays only
// (Mon–Fri): Day 1 is the start date (or the Monday after, if it falls on a weekend) and each later
// day is the next weekday, so 30 days take six calendar weeks. No lesson is dropped; only dates move.
export const COURSE_DAYS = 30;

/** Local midnight of the date's calendar day. */
export function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Monday–Friday. */
export const isStudyDay = (date: Date) => date.getDay() !== 0 && date.getDay() !== 6;

/** The date itself, or the next Monday when it is a Saturday or Sunday. */
export function nextStudyDay(date: Date): Date {
  let d = localDay(date);
  while (!isStudyDay(d)) d = addDays(d, 1);
  return d;
}

/** Calendar days between two local dates (DST-safe: compares UTC dates of the local calendar days). */
function dayDiff(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** Weekdays in [a, b) — a and b are local dates, a ≤ b. */
function weekdaysBetween(a: Date, b: Date): number {
  const days = dayDiff(a, b);
  const weeks = Math.floor(days / 7);
  let n = weeks * 5;
  for (let d = addDays(localDay(a), weeks * 7); dayDiff(d, b) > 0; d = addDays(d, 1)) if (isStudyDay(d)) n++;
  return n;
}

export function plannedDate(start: Date, day: number): Date {
  let d = nextStudyDay(start);
  const weeks = Math.floor((day - 1) / 5);
  d = addDays(d, weeks * 7);
  for (let left = (day - 1) % 5; left > 0; left--) {
    d = addDays(d, 1);
    while (!isStudyDay(d)) d = addDays(d, 1);
  }
  return d;
}

export const finishDate = (start: Date) => plannedDate(start, COURSE_DAYS);

/**
 * Which plan day `today` is (1 = first study day). On a weekend it is the day planned for the coming
 * Monday. 0 or less = not started yet; > 30 = past the finish date.
 */
export function planDayOn(start: Date, today: Date): number {
  const first = nextStudyDay(start);
  const t = localDay(today);
  if (dayDiff(first, t) < 0) return 0 - weekdaysBetween(t, first);
  return weekdaysBetween(first, t) + 1;
}

export interface ScheduleStatus {
  planDay: number;
  expectedDone: number;
  delta: number;
  state: 'not-started' | 'ahead' | 'on-track' | 'behind';
}

/** Compares completed days with the days that should be finished before today. */
export function scheduleStatus(start: Date, today: Date, completed: number): ScheduleStatus {
  const planDay = planDayOn(start, today);
  const expectedDone = Math.max(0, Math.min(COURSE_DAYS, planDay - 1));
  const delta = completed - expectedDone;
  const state = planDay < 1 && completed === 0 ? 'not-started' : delta > 0 ? 'ahead' : delta < 0 ? 'behind' : 'on-track';
  return { planDay, expectedDone, delta, state };
}

export const toDateInput = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function fromDateInput(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw new Error('Invalid date');
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (date.getMonth() !== Number(m[2]) - 1 || date.getDate() !== Number(m[3])) throw new Error('Invalid date');
  return date;
}

/** e.g. "Mon, 2 Nov 2026" in the browser's locale. */
export const formatDate = (date: Date, locale?: string) => date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

/**
 * The finish date at the learner's real pace, recomputed whenever the page loads (no background job):
 * the original finish moved by the lag — each study day behind pushes it one weekday later, each day
 * ahead pulls it one weekday earlier. Before the start it is the original finish; once all 30 days are
 * done it is null (finished).
 */
export function projectedFinish(start: Date, today: Date, completed: number): Date | null {
  if (completed >= COURSE_DAYS) return null;
  const { delta, state } = scheduleStatus(start, today, completed);
  if (state === 'not-started') return finishDate(start);
  return plannedDate(start, COURSE_DAYS - delta);
}


/** Study weeks: five lesson days (Mon–Fri) each, so the 30 days make six weeks. The course's topic
 *  groups (course.yaml `weeks`) are shown as "Modules" so a week never lists seven days. */
export const STUDY_WEEK_DAYS = 5;
export const STUDY_WEEKS = Math.ceil(COURSE_DAYS / STUDY_WEEK_DAYS);
export const studyWeekOf = (day: number) => Math.floor((day - 1) / STUDY_WEEK_DAYS) + 1;
export function studyWeekDays(week: number): number[] {
  const first = (week - 1) * STUDY_WEEK_DAYS + 1;
  return Array.from({ length: STUDY_WEEK_DAYS }, (_, i) => first + i).filter((n) => n <= COURSE_DAYS);
}
