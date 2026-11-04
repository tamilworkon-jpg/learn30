import { describe, expect, it } from 'vitest';
import { lessonHref, passed, PASS_MARK, revisitLinks } from '../../src/lib/next-steps';
import type { Question } from '../../src/lib/types';

const q = (id: string, lessonRef: string, answer: string[]): Question =>
  ({ id, set: 'day-02', domain: 'D1', taskStatement: '1.1', type: 'single', stem: id, options: [{ id: 'a', text: 'A', explanation: '' }, { id: 'b', text: 'B', explanation: '' }], answer, explanation: '', lessonRef, difficulty: 'easy' }) as unknown as Question;

describe('next steps after a quiz', () => {
  it('pass mark is 80% (rounded score)', () => {
    expect(PASS_MARK).toBe(80);
    expect(passed(80)).toBe(true);
    expect(passed(79.6)).toBe(true);
    expect(passed(79.4)).toBe(false);
  });

  it('lesson refs become day links', () => {
    expect(lessonHref('day-02#explanation')).toBe('/course/aws-ai-practitioner/day/02#explanation');
    expect(lessonHref('day-02#explanation', 'demo-course')).toBe('/course/demo-course/day/02#explanation');
    expect(lessonHref('day-15')).toBe('/course/aws-ai-practitioner/day/15');
  });

  it('revisit = unique sections behind wrong answers, in question order, with miss counts and titles', () => {
    const qs = [q('1', 'day-02#examples', ['a']), q('2', 'day-02#explanation', ['a']), q('3', 'day-02#examples', ['b']), q('4', 'day-01#recap', ['a'])];
    const answers = { '1': ['b'], '2': ['a'], '3': ['a'] }; // 1 wrong, 2 right, 3 wrong, 4 unanswered (wrong)
    const links = revisitLinks(qs, answers, { 'day-02#examples': 'Day 2 · Examples: which fits?' });
    expect(links.map((l) => [l.href, l.title, l.misses])).toEqual([
      ['/course/aws-ai-practitioner/day/02#examples', 'Day 2 · Examples: which fits?', 2],
      ['/course/aws-ai-practitioner/day/01#recap', 'Day 1 · Recap', 1],
    ]);
    expect(revisitLinks(qs, { '1': ['a'], '2': ['a'], '3': ['b'], '4': ['a'] })).toEqual([]);
  });
});
