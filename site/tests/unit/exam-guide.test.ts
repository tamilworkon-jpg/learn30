import { describe, expect, it } from 'vitest';
import { examGuide, course } from '../../src/lib/data';
import { EXAM_GUIDE_VERSION } from '../../src/lib/constants';

describe('exam guide data (T012)', () => {
  it('F1 identifies AIF-C01 guide v1.2', () => {
    expect(examGuide.examCode).toBe('AIF-C01');
    expect(examGuide.version).toBe('1.2');
    expect(EXAM_GUIDE_VERSION).toBe(examGuide.version);
    expect(examGuide.publishedOn).toBe('2026-10-29');
  });

  it('F2 has 5 domains weighted 20/24/28/14/14', () => {
    expect(examGuide.domains.map((d) => d.weight)).toEqual([20, 24, 28, 14, 14]);
    expect(examGuide.domains.reduce((s, d) => s + d.weight, 0)).toBe(100);
  });

  it('F3 has exactly the 14 task statements', () => {
    const ids = examGuide.domains.flatMap((d) => d.tasks.map((t) => t.id));
    expect(ids).toEqual(['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '3.4', '4.1', '4.2', '5.1', '5.2']);
    for (const d of examGuide.domains) for (const t of d.tasks) expect(t.objectives.length).toBeGreaterThan(0);
  });

  it('F4 exam format', () => {
    expect(examGuide.format).toEqual({ totalQuestions: 65, scored: 50, minutes: 90, passScaled: 700, scaleMin: 100, scaleMax: 1000 });
  });

  it('F5 in/out-of-scope lists are disjoint and WAF is out of scope', () => {
    const inScope = new Set(examGuide.inScopeServices);
    expect(examGuide.outOfScopeServices.filter((s) => inScope.has(s))).toEqual([]);
    expect(examGuide.outOfScopeServices).toContain('AWS WAF');
    expect(examGuide.inScopeServices).toContain('Amazon Bedrock AgentCore');
  });

  it('F41 course has 30 days: 24 lesson, 4 review, 2 mock', () => {
    expect(course.days).toHaveLength(30);
    const count = (k: string) => course.days.filter((d) => d.kind === k).length;
    expect([count('lesson'), count('review'), count('mock')]).toEqual([24, 4, 2]);
    expect(course.days.filter((d) => d.kind === 'review').map((d) => d.day)).toEqual([7, 14, 21, 28]);
    const known = new Set(examGuide.domains.flatMap((d) => d.tasks.map((t) => t.id)));
    for (const d of course.days.filter((x) => x.kind === 'lesson')) {
      expect(d.taskStatements.length).toBeGreaterThan(0);
      for (const ts of d.taskStatements) expect(known.has(ts)).toBe(true);
    }
  });
});
