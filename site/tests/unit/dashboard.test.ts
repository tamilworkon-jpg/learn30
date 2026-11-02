import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../src/lib/course-plan';
import { completedCount, continueTarget, minutesLeft, percentComplete, sectionProgress, upcoming } from '../../src/lib/dashboard';
import { course, examGuide } from '../../src/lib/data';
import { defaultProgress } from '../../src/lib/progress/store';

// T072 / T075 — dashboard derivations.
const body = `<Section id="recap" type="recap" title="Recap" minutes={3}>x</Section>
<Section id="hands-on" type="handsOn" title="Lab" minutes={8}>x</Section>
<Section id="quiz" type="quiz" minutes={20}>x</Section>
<Section id="deep-dive" type="deepDive" title="Deep" minutes={15} optional>x</Section>`;
const plan = buildPlan(course, examGuide.domains, [1, 2, 3].map((day) => ({ day, body })));

describe('course plan', () => {
  it('lists all 30 days in 5 weeks; days without content are unavailable', () => {
    expect(plan.days).toHaveLength(30);
    expect(plan.weeks.map((w) => w.days.length)).toEqual([7, 7, 7, 7, 2]);
    expect(plan.days[2]).toMatchObject({ available: true, minutes: 31, domains: ['D1'] });
    expect(plan.days[2].sections.map((s) => s.title)).toEqual(['Recap', 'Lab', 'Quiz', 'Deep']);
    expect(plan.days[3]).toMatchObject({ day: 4, available: false, minutes: 60 });
    expect(plan.days[9].domains).toEqual(['D2', 'D3']);
  });
});

describe('dashboard helpers', () => {
  it('fresh learner: 0%, continue → Day 1', () => {
    const p = defaultProgress();
    expect(percentComplete(p, plan)).toBe(0);
    expect(continueTarget(p, plan)).toMatchObject({ day: 1, href: '/day/01', resumed: false });
  });

  it('R5 Days 1–2 complete + Day 3 hands-on → 2/30 (7%), continue /day/03#hands-on', () => {
    const p = defaultProgress();
    p.days = { '1': { status: 'completed', sectionsViewed: [] }, '2': { status: 'completed', sectionsViewed: [] }, '3': { status: 'in-progress', sectionsViewed: ['recap', 'hands-on'] } };
    p.lastPosition = { day: 3, sectionId: 'hands-on', updatedAt: '2026-11-02T10:00:00Z' };
    expect(completedCount(p, plan)).toBe(2);
    expect(percentComplete(p, plan)).toBe(7);
    expect(continueTarget(p, plan)).toMatchObject({ day: 3, href: '/day/03#hands-on', resumed: true });
    expect(minutesLeft(p, plan.days[2])).toBe(20);
    expect(sectionProgress(p, plan.days[2])).toBe(67);
    expect(minutesLeft(p, plan.days[3])).toBe(60);
    expect(upcoming(plan, 3, 2).map((d) => d.day)).toEqual([4, 5]);
  });

  it('last position on a completed day falls through to the next incomplete day', () => {
    const p = defaultProgress();
    p.days = { '1': { status: 'completed', sectionsViewed: [] } };
    p.lastPosition = { day: 1, sectionId: 'summary', updatedAt: '2026-11-02T10:00:00Z' };
    expect(continueTarget(p, plan)).toMatchObject({ day: 2, href: '/day/02' });
  });

  it('everything complete → Day 1', () => {
    const p = defaultProgress();
    for (let d = 1; d <= 30; d++) p.days[String(d)] = { status: 'completed', sectionsViewed: [] };
    expect(percentComplete(p, plan)).toBe(100);
    expect(continueTarget(p, plan).day).toBe(1);
  });
});
