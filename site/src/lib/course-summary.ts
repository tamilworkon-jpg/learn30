// Learn30 — per-course progress summary for platform pages (catalogue cards, "My courses").
// The server puts it in the page bootstrap (#aip-bootstrap → `summary`, spec 002 contracts/progress-api-v2.md):
// { courses: { [id]: { completed, startedAt, lastPosition, updatedAt } } }. Read defensively: absent or
// malformed → null (signed out, or a server that predates per-course progress).
import { BOOTSTRAP_ID } from './bootstrap';

export interface CourseSummary {
  completed: number;
  startedAt: string;
  lastPosition: { day: number; sectionId?: string } | null;
  updatedAt?: string;
}
export type Summary = Record<string, CourseSummary>;

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function clean(v: unknown): CourseSummary | null {
  if (!isObj(v) || typeof v.completed !== 'number' || typeof v.startedAt !== 'string' || Number.isNaN(Date.parse(v.startedAt))) return null;
  const lp = isObj(v.lastPosition) && typeof v.lastPosition.day === 'number' ? { day: v.lastPosition.day, sectionId: typeof v.lastPosition.sectionId === 'string' ? v.lastPosition.sectionId : undefined } : null;
  return { completed: Math.max(0, Math.floor(v.completed)), startedAt: v.startedAt, lastPosition: lp, updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : undefined };
}

/** Parses a `summary` value; keeps only well-formed course entries. */
export function parseSummary(raw: unknown): Summary | null {
  const courses = isObj(raw) && isObj(raw.courses) ? raw.courses : null;
  if (!courses) return null;
  const out: Summary = {};
  for (const [id, v] of Object.entries(courses)) {
    const c = clean(v);
    if (c && /^[a-z0-9-]+$/.test(id)) out[id] = c;
  }
  return out;
}

/** The bootstrap's summary, or null. */
export function readSummary(doc: Document = document): Summary | null {
  const el = doc.getElementById(BOOTSTRAP_ID);
  if (!el || el.getAttribute('type') !== 'application/json') return null;
  try {
    return parseSummary((JSON.parse(el.textContent ?? '') as Record<string, unknown>)?.summary);
  } catch {
    return null;
  }
}

/** The next day to study from a summary: the last opened (unfinished) day, else the first not yet done. */
export function nextDayOf(s: CourseSummary, lengthDays: number): number {
  if (s.lastPosition && s.lastPosition.day >= 1 && s.lastPosition.day <= lengthDays && s.lastPosition.day > s.completed) return s.lastPosition.day;
  return Math.min(lengthDays, s.completed + 1);
}
