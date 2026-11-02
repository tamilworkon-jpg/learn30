import { describe, expect, it } from 'vitest';
import { weakDomains } from '../../src/lib/weak-domains';
import { course, examGuide } from '../../src/lib/data';
import type { Attempt, DomainScores } from '../../src/lib/types';

// T064 — R3 domain weak when < 70% with ≥5 answered over latest attempts; R4 returns linked days.
let seq = 0;
const attempt = (assessmentId: string, byDomain: DomainScores, submittedAt = `2026-11-0${++seq % 9}T10:00:00Z`): Attempt => ({
  id: `${assessmentId}-${seq}`,
  assessmentId,
  kind: 'daily',
  startedAt: submittedAt,
  submittedAt,
  answers: {},
  flagged: [],
  score: { correct: 0, total: 0, percent: 0 },
  byDomain,
  autoSubmitted: false,
});

describe('weak domains (T064)', () => {
  it('R3 flags a domain under 70% with at least 5 answered', () => {
    const r = weakDomains([attempt('day-01', { D1: { correct: 6, total: 10 }, D4: { correct: 4, total: 5 } })], course, examGuide.domains);
    expect(r.map((w) => w.domain)).toEqual(['D1']);
    expect(r[0]).toMatchObject({ correct: 6, total: 10, percent: 60 });
  });

  it('R3 ignores domains with fewer than 5 answered', () => {
    expect(weakDomains([attempt('day-02', { D4: { correct: 0, total: 4 } })], course, examGuide.domains)).toEqual([]);
  });

  it('R3 70% exactly is not weak', () => {
    expect(weakDomains([attempt('day-01', { D1: { correct: 7, total: 10 } })], course, examGuide.domains)).toEqual([]);
  });

  it('R3 uses only the latest attempt per assessment and aggregates across assessments', () => {
    const r = weakDomains(
      [
        attempt('day-01', { D1: { correct: 1, total: 10 } }, '2026-11-01T10:00:00Z'),
        attempt('day-01', { D1: { correct: 9, total: 10 } }, '2026-11-02T10:00:00Z'),
        attempt('day-02', { D1: { correct: 2, total: 5 } }, '2026-11-02T11:00:00Z'),
      ], course, examGuide.domains);
    // latest day-01 (9/10) + day-02 (2/5) = 11/15 = 73% → not weak
    expect(r).toEqual([]);
    const r2 = weakDomains([attempt('day-01', { D1: { correct: 9, total: 10 } }, '2026-11-01T10:00:00Z'), attempt('day-01', { D1: { correct: 3, total: 10 } }, '2026-11-03T10:00:00Z')], course, examGuide.domains);
    expect(r2[0]).toMatchObject({ domain: 'D1', percent: 30 });
  });

  it('R3 sorts weakest first', () => {
    const r = weakDomains([attempt('day-03', { D1: { correct: 6, total: 10 }, D3: { correct: 1, total: 5 } })], course, examGuide.domains);
    expect(r.map((w) => w.domain)).toEqual(['D3', 'D1']);
  });

  it('R4 returns the lesson days that teach the domain', () => {
    const r = weakDomains([attempt('day-01', { D3: { correct: 1, total: 5 } })], course, examGuide.domains);
    // D3 = task statements 3.x → lesson days 10, 13, 15–20
    expect(r[0].days).toEqual([10, 13, 15, 16, 17, 18, 19, 20]);
    const d1 = weakDomains([attempt('day-01', { D1: { correct: 1, total: 5 } })], course, examGuide.domains)[0];
    expect(d1.days).toEqual([1, 2, 3, 4, 5, 6]);
  });
});
