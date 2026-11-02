import { describe, expect, it } from 'vitest';
import { coreMinutes, getPrevNext, getRecapData, SECTION_ORDER } from '../../src/lib/lesson-utils';
import { estimateMinutes, parseLesson } from '../../src/lib/validate';
import { course } from '../../src/lib/data';

const lessons = [
  { day: 1, title: 'Orientation', keyPoints: ['a', 'b', 'c'] },
  { day: 2, title: 'ML vocabulary', keyPoints: ['d', 'e', 'f', 'g'] },
];

describe('lesson utils (T033)', () => {
  it('U1 recap returns previous day title + key points; Day 1 → orientation', () => {
    expect(getRecapData(1, lessons)).toEqual({ kind: 'orientation' });
    expect(getRecapData(2, lessons)).toEqual({ kind: 'recap', day: 1, title: 'Orientation', keyPoints: ['a', 'b', 'c'] });
    expect(getRecapData(3, lessons)).toEqual({ kind: 'recap', day: 2, title: 'ML vocabulary', keyPoints: ['d', 'e', 'f', 'g'] });
    expect(getRecapData(5, lessons)).toEqual({ kind: 'missing', day: 4 });
  });

  it('U2 coreMinutes excludes optional sections', () => {
    const src = '<Section id="a" type="recap" title="A" minutes={5}>x</Section><Section id="b" type="explanation" title="B" minutes={20}>y</Section><Section id="deep-dive" type="deepDive" title="D" minutes={15} optional>z</Section>';
    const parsed = parseLesson(src);
    expect(parsed.sections.map((s) => [s.id, s.title, s.minutes])).toEqual([
      ['a', 'A', 5],
      ['b', 'B', 20],
      ['deep-dive', 'D', 15],
    ]);
    expect(coreMinutes(parsed.sections)).toBe(25);
  });

  it('U3 estimateMinutes = core words ÷ 130 + diagrams × 1 + lab 8 + 1 min per quiz question (optional excluded)', () => {
    const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');
    const src = [
      `<Section id="explanation" type="explanation" title="E" minutes={20}>${words(1300)}`,
      '<Diagram code="graph TD; A-->B" caption="A to B" /></Section>',
      `<Section id="deep-dive" type="deepDive" title="D" minutes={15} optional>${words(5000)}<Diagram code="graph TD; C-->D" caption="C" /></Section>`,
    ].join('');
    const parsed = parseLesson(src);
    expect(estimateMinutes(parsed)).toBe(10 + 1 + 8 + 20);
    expect(estimateMinutes(parsed, 15)).toBe(10 + 1 + 8 + 15);
  });

  it('U4 prev/next skip nothing and stop at the ends', () => {
    expect(getPrevNext(1, course)).toEqual({ prev: null, next: 2 });
    expect(getPrevNext(15, course)).toEqual({ prev: 14, next: 16 });
    expect(getPrevNext(30, course)).toEqual({ prev: 29, next: null });
  });

  it('section order matches data-model', () => {
    expect(SECTION_ORDER).toEqual(['recap', 'objectives', 'explanation', 'diagram', 'examples', 'realWorld', 'handsOn', 'examTips', 'summary', 'quiz', 'deepDive']);
  });
});
