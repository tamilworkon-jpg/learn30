import { describe, expect, it } from 'vitest';
import { estimateMinutes, parseLesson, validateContent, type QuestionSet } from '../../src/lib/validate';
import { course, examGuide } from '../../src/lib/data';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

function lessonMdx(day: number, opts: { omit?: string; swap?: boolean; text?: string; minutes?: number; traps?: string[]; noDeepDiagram?: boolean } = {}) {
  const types = [day === 1 ? 'orientation' : 'recap', 'objectives', 'explanation', 'diagram', 'examples', 'realWorld', 'handsOn', 'examTips', 'summary', 'quiz'];
  if (opts.swap) [types[2], types[3]] = [types[3], types[2]];
  const body = types
    .filter((t) => t !== opts.omit)
    .map((t) => {
      const inner = t === 'diagram' ? '<Diagram caption="c">graph TD; A-->B</Diagram>' : t === 'explanation' ? (opts.text ?? words(3000)) : 'text';
      return `<Section id="${t.toLowerCase()}" type="${t}">\n${inner}\n</Section>`;
    })
    .join('\n');
  const deep = opts.omit === 'deepDive' ? '' : `<Section id="deep-dive" type="deepDive" optional>\n${opts.noDeepDiagram ? 'no diagram' : '<Diagram caption="arch">graph LR; A-->B</Diagram>'}\n</Section>`;
  const cd = course.days.find((d) => d.day === day)!;
  const fm = [
    '---',
    `day: ${day}`,
    'kind: lesson',
    `title: "${cd.title}"`,
    'summary: "s"',
    'domains: [D1]',
    `taskStatements: [${cd.taskStatements.map((t) => `"${t}"`).join(', ')}]`,
    'sources: [{ provider: skillbuilder, title: "Fundamentals" }]',
    'objectives: [a, b, c]',
    `estimatedMinutes: ${opts.minutes ?? 60}`,
    'deepDiveMinutes: 15',
    'lastVerified: "2026-11-02"',
    opts.traps ? `examTraps: [${opts.traps.map((t) => `"${t}"`).join(', ')}]` : '',
    '---',
  ].join('\n');
  return `${fm}\n${body}\n${deep}\n`;
}

function qset(set: string, n: number, opts: { domain?: string; ts?: string; ref?: string; stemPrefix?: string; idPrefix?: string } = {}): QuestionSet {
  return {
    set,
    questions: Array.from({ length: n }, (_, i) => ({
      id: `q-${opts.idPrefix ?? set}-${String(i + 1).padStart(3, '0')}`,
      set,
      type: 'single',
      stem: `${opts.stemPrefix ?? set} question number ${i + 1}?`,
      options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: id, explanation: `because ${id}` })),
      answer: ['a'],
      explanation: 'Detailed explanation of the answer.',
      domain: opts.domain ?? 'D1',
      taskStatement: opts.ts ?? '1.1',
      lessonRef: opts.ref ?? 'day-02#explanation',
      difficulty: 'easy',
    })),
  } as QuestionSet;
}

const run = (lessons: Record<number, string>, sets: QuestionSet[], final = false) =>
  validateContent({ lessons: Object.entries(lessons).map(([d, src]) => ({ file: `day-${d}.mdx`, source: src })), questionSets: sets, guide: examGuide, course, final });

describe('content validator (T014)', () => {
  it('valid lesson + daily set passes; other days pending', () => {
    const r = run({ 2: lessonMdx(2) }, [qset('day-02', 20)]);
    expect(r.errors).toEqual([]);
    expect(r.pending).toContain(1);
  });

  it('F11 missing and out-of-order sections', () => {
    expect(run({ 2: lessonMdx(2, { omit: 'realWorld' }) }, []).errors.join()).toMatch(/realWorld/);
    expect(run({ 2: lessonMdx(2, { swap: true }) }, []).errors.join()).toMatch(/order/i);
  });

  it('F12 time estimate outside 50–70 or off declared', () => {
    expect(run({ 2: lessonMdx(2, { text: words(300) }) }, [qset('day-02', 20)]).errors.join()).toMatch(/minutes/);
    expect(run({ 2: lessonMdx(2, { minutes: 70 }) }, [qset('day-02', 20)]).errors.join()).toMatch(/declared/);
    expect(estimateMinutes(parseLesson(lessonMdx(2)), 20)).toBeGreaterThanOrEqual(50);
  });

  it('F13 set counts and mock split', () => {
    expect(run({}, [qset('day-02', 12)]).errors.join()).toMatch(/day-02.*15/);
    expect(run({}, [qset('week-1', 50)]).errors.join()).toMatch(/week-1.*55/);
    expect(run({}, [qset('mock-1', 65)]).errors.join()).toMatch(/split/);
  });

  it('F14 duplicate id and reused stem', () => {
    const a = qset('day-02', 20);
    const b = qset('day-03', 20, { idPrefix: 'day-02', ref: 'day-02#explanation' });
    b.questions.forEach((q) => (q.set = 'day-03'));
    expect(run({ 2: lessonMdx(2) }, [a, b]).errors.join()).toMatch(/duplicate id/i);
    const c = qset('day-03', 20, { stemPrefix: 'day-02' });
    expect(run({ 2: lessonMdx(2) }, [a, c]).errors.join()).toMatch(/stem/i);
  });

  it('F15/F19 final mode: coverage and total', () => {
    const r = run({}, [], true);
    expect(r.errors.join()).toMatch(/1\.2.*fewer than 3/);
    expect(r.errors.join()).toMatch(/900/);
  });

  it('F16 unresolvable lessonRef', () => {
    expect(run({ 2: lessonMdx(2) }, [qset('day-02', 20, { ref: 'day-02#nope' })]).errors.join()).toMatch(/lessonRef/);
  });

  it('F17 out-of-scope service needs an examTraps entry', () => {
    const src = lessonMdx(2, { text: `${words(3000)} AWS WAF protects web apps.` });
    expect(run({ 2: src }, [qset('day-02', 20)]).errors.join()).toMatch(/AWS WAF/);
    const ok = lessonMdx(2, { text: `${words(3000)} AWS WAF protects web apps.`, traps: ['AWS WAF'] });
    expect(run({ 2: ok }, [qset('day-02', 20)]).errors).toEqual([]);
  });

  it('F18 deep dive needs an architecture diagram', () => {
    expect(run({ 2: lessonMdx(2, { noDeepDiagram: true }) }, [qset('day-02', 20)]).errors.join()).toMatch(/deepDive/);
    expect(run({ 2: lessonMdx(2, { omit: 'deepDive' }) }, [qset('day-02', 20)]).errors.join()).toMatch(/deepDive/);
    const notOptional = lessonMdx(2).replace('type="deepDive" optional', 'type="deepDive"');
    expect(run({ 2: notOptional }, [qset('day-02', 20)]).errors.join()).toMatch(/optional/);
  });

  it('F18b ordering and matching answer keys must be complete', () => {
    const s = qset('day-02', 20);
    Object.assign(s.questions[0], { type: 'ordering', options: s.questions[0].options.slice(0, 3), answer: ['a', 'b'] });
    Object.assign(s.questions[1], {
      type: 'matching',
      options: s.questions[1].options.slice(0, 3),
      matchTargets: [{ id: 'x', text: 'X' }, { id: 'y', text: 'Y' }, { id: 'z', text: 'Z' }],
      answer: { a: 'x', b: 'nope', c: 'z' },
    });
    const errs = run({ 2: lessonMdx(2) }, [s]).errors.join();
    expect(errs).toMatch(/permutation/);
    expect(errs).toMatch(/pair every option/);
  });

  it('F20 pending days become errors in final mode', () => {
    expect(run({}, [], true).errors.join()).toMatch(/Day 1 has no content/);
  });
});
