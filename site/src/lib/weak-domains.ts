// T069 — weak domains = < 70% correct with ≥ 5 answered, over the latest attempt of each assessment.
// Pure: course + domains are passed in so client islands don't bundle the YAML parser.
import type { Attempt, CourseDay, Domain, DomainId } from './types';

type CourseDays = { days: CourseDay[] };

export const WEAK_THRESHOLD = 70;
export const MIN_ANSWERED = 5;

export interface WeakDomain {
  domain: DomainId;
  name: string;
  correct: number;
  total: number;
  percent: number;
  /** Lesson days that teach this domain (for "revisit" links). */
  days: number[];
}

export function latestAttempts(attempts: Attempt[]): Attempt[] {
  const latest = new Map<string, Attempt>();
  for (const a of attempts) {
    const prev = latest.get(a.assessmentId);
    if (!prev || a.submittedAt >= prev.submittedAt) latest.set(a.assessmentId, a);
  }
  return [...latest.values()];
}

export function domainDays(domain: DomainId, course: CourseDays, domains: Domain[]): number[] {
  const tasks = new Set(domains.find((d) => d.id === domain)?.tasks.map((t) => t.id) ?? []);
  return course.days.filter((d) => d.kind === 'lesson' && d.taskStatements.some((t) => tasks.has(t))).map((d) => d.day);
}

export function weakDomains(attempts: Attempt[], course: CourseDays, domains: Domain[]): WeakDomain[] {
  const totals = new Map<DomainId, { correct: number; total: number }>();
  for (const a of latestAttempts(attempts)) {
    for (const [id, s] of Object.entries(a.byDomain) as [DomainId, { correct: number; total: number }][]) {
      const t = totals.get(id) ?? { correct: 0, total: 0 };
      t.correct += s.correct;
      t.total += s.total;
      totals.set(id, t);
    }
  }
  const out: WeakDomain[] = [];
  for (const [domain, t] of totals) {
    const percent = Math.round((100 * t.correct) / t.total);
    if (t.total >= MIN_ANSWERED && (100 * t.correct) / t.total < WEAK_THRESHOLD) {
      out.push({ domain, name: domains.find((d) => d.id === domain)?.name ?? domain, ...t, percent, days: domainDays(domain, course, domains) });
    }
  }
  return out.sort((a, b) => a.percent - b.percent || a.domain.localeCompare(b.domain));
}
