// T183 — the learner's 30-day plan in the browser's local time zone: Day N = start + N − 1 calendar days.
export const COURSE_DAYS = 30;

/** Local midnight of the date's calendar day. */
export function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function plannedDate(start: Date, day: number): Date {
  const s = localDay(start);
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + day - 1);
}

export const finishDate = (start: Date) => plannedDate(start, COURSE_DAYS);

/** Calendar days between two local dates (DST-safe: compares UTC dates of the local calendar days). */
function dayDiff(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** Which plan day `today` is (1 = start date). 0 or less = not started yet; > 30 = past the finish date. */
export const planDayOn = (start: Date, today: Date) => dayDiff(start, today) + 1;

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
