import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';
import { describe, expect, it } from 'vitest';
import { validateQuestion } from '../../src/schemas';
import { course } from '../../src/lib/data';
import { parseLesson } from '../../src/lib/lesson-parse';
import type { Question } from '../../src/lib/types';

// TC-Q Q1–Q6 for every authored question set (Q7 is the reviewer-model answer-key check in T181).
const dir = resolve(__dirname, '../../src/content/questions/aws-ai-practitioner');
const lessonDir = resolve(__dirname, '../../src/content/lessons/aws-ai-practitioner');
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.yaml')) : [];
const sets = new Map(files.map((f) => [f.replace('.yaml', ''), load(readFileSync(resolve(dir, f), 'utf8')) as Question[]]));

const sectionIds = new Map<string, Set<string>>(
  (existsSync(lessonDir) ? readdirSync(lessonDir).filter((f) => f.endsWith('.mdx')) : []).map((f) => {
    const l = parseLesson(readFileSync(resolve(lessonDir, f), 'utf8'));
    return [`day-${String(l.frontmatter.day).padStart(2, '0')}`, new Set(l.sections.map((s) => s.id))];
  }),
);

const normStem = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Cross-set checks Q2 (global id/stem uniqueness), Q3 (answer ids exist, every option explained), Q4 (lessonRef resolves). */
function crossSetProblems(all: Map<string, Question[]>, sections: Map<string, Set<string>>): string[] {
  const problems: string[] = [];
  const ids = new Map<string, string>();
  const stems = new Map<string, string>();
  for (const [set, qs] of all) {
    for (const q of qs) {
      if (ids.has(q.id)) problems.push(`Q2 duplicate id ${q.id} (${ids.get(q.id)} and ${set})`);
      ids.set(q.id, set);
      const stem = normStem(q.stem ?? '');
      if (stems.has(stem)) problems.push(`Q2 reused stem in ${q.id} (first seen in ${stems.get(stem)})`);
      stems.set(stem, q.id);

      const optionIds = new Set((q.options ?? []).map((o) => o.id));
      for (const o of q.options ?? []) if (!o.explanation?.trim()) problems.push(`Q3 ${q.id} option ${o.id} has no explanation`);
      if (q.type === 'matching') {
        const targets = new Set((q.matchTargets ?? []).map((t) => t.id));
        for (const [opt, target] of Object.entries(q.answer as Record<string, string>)) {
          if (!optionIds.has(opt)) problems.push(`Q3 ${q.id} answer references unknown option ${opt}`);
          if (!targets.has(target)) problems.push(`Q3 ${q.id} answer references unknown target ${target}`);
        }
      } else {
        for (const a of q.answer as string[]) if (!optionIds.has(a)) problems.push(`Q3 ${q.id} answer references unknown option ${a}`);
      }

      const [lessonDay, anchor] = (q.lessonRef ?? '').split('#');
      if (!sections.get(lessonDay)?.has(anchor)) problems.push(`Q4 ${q.id} lessonRef ${q.lessonRef} does not resolve`);
    }
  }
  return problems;
}

describe('question sets (TC-Q)', () => {
  describe('cross-set checker catches broken content', () => {
    const base: Question = {
      id: 'q-day-01-001',
      set: 'day-01',
      type: 'single',
      stem: 'Which service is fully managed?',
      options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id, explanation: `why ${id}` })),
      answer: ['b'],
      explanation: 'b',
      domain: 'D1',
      taskStatement: '1.1',
      lessonRef: 'day-01#explanation',
      difficulty: 'easy',
    };
    const secs = new Map([['day-01', new Set(['explanation'])]]);
    const check = (qs: Question[]) => crossSetProblems(new Map([['day-01', qs]]), secs);

    it('accepts a valid question', () => expect(check([base])).toEqual([]));
    it('Q2 duplicate id and reused stem across sets', () => {
      const p = crossSetProblems(new Map([['day-01', [base]], ['day-02', [{ ...base, set: 'day-02', stem: 'which service is fully-managed' }]]]), secs);
      expect(p.join('\n')).toMatch(/Q2 duplicate id/);
      expect(p.join('\n')).toMatch(/Q2 reused stem/);
    });
    it('Q3 unknown answer id and missing explanation', () => {
      const p = check([{ ...base, answer: ['z'], options: [...base.options.slice(0, 3), { id: 'd', text: 'd', explanation: ' ' }] }]);
      expect(p.join('\n')).toMatch(/unknown option z/);
      expect(p.join('\n')).toMatch(/option d has no explanation/);
    });
    it('Q3 matching answers must reference options and targets', () => {
      const m: Question = { ...base, type: 'matching', matchTargets: [{ id: 't1', text: 'T1' }], answer: { a: 't1', x: 't9' } };
      const p = check([m]).join('\n');
      expect(p).toMatch(/unknown option x/);
      expect(p).toMatch(/unknown target t9/);
    });
    it('Q4 unresolvable lessonRef', () => expect(check([{ ...base, lessonRef: 'day-01#nope' }]).join('\n')).toMatch(/Q4/));
  });

  it('Q2–Q4 hold across all authored sets', () => {
    expect(crossSetProblems(sets, sectionIds)).toEqual([]);
  });

  for (const [set, qs] of sets) {
    describe(set, () => {
      it('Q1 count rule', () => {
        const [min, max] = set.startsWith('day-') ? [15, 20] : set.startsWith('week-') ? [55, 60] : [65, 65];
        expect(qs.length).toBeGreaterThanOrEqual(min);
        expect(qs.length).toBeLessThanOrEqual(max);
      });
      it('Q2/Q3 schema valid, ids in set', () => {
        for (const q of qs) {
          expect(validateQuestion(q), `${q.id}: ${JSON.stringify(validateQuestion.errors)}`).toBe(true);
          expect(q.set).toBe(set);
          expect(q.id.startsWith(`q-${set}-`)).toBe(true);
        }
      });
      it('Q5 type mix ≈ 70/20/10 (±10%)', () => {
        const share = (t: string[]) => qs.filter((q) => t.includes(q.type)).length / qs.length;
        expect(share(['single'])).toBeGreaterThanOrEqual(0.6);
        expect(share(['single'])).toBeLessThanOrEqual(0.8);
        expect(share(['multi'])).toBeGreaterThanOrEqual(0.1);
        expect(share(['ordering', 'matching'])).toBeGreaterThanOrEqual(0.05);
      });
      if (set.startsWith('day-')) {
        it('Q6 task statements match the day', () => {
          const allowed = course.days.find((d) => d.day === Number(set.slice(4)))!.taskStatements;
          for (const q of qs) expect(allowed, q.id).toContain(q.taskStatement);
        });
        it('answer positions are spread (not always A)', () => {
          const singles = qs.filter((q) => q.type === 'single').map((q) => (q.answer as string[])[0]);
          expect(new Set(singles).size).toBeGreaterThanOrEqual(3);
        });
      }
    });
  }
});
