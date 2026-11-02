import { describe, expect, it } from 'vitest';
import { computeCoverage, coverageSummary } from '../../src/lib/coverage';
import { course, examGuide } from '../../src/lib/data';

const q = (taskStatement: string, lessonRef: string) => ({ taskStatement, lessonRef });

describe('coverage matrix (T095)', () => {
  const lessons = [
    { day: 1, taskStatements: ['1.1'] },
    { day: 2, taskStatements: ['1.1', '4.1'] },
  ];
  const questions = [q('1.1', 'day-01#explanation'), q('1.1', 'day-02#explanation'), q('1.1', 'day-01#explanation'), q('4.1', 'day-02#explanation')];
  const rows = computeCoverage({ guide: examGuide, course, lessons, questions, glossary: [{ taskStatements: ['1.1', '2.1'] }] });
  const row = (id: string) => rows.find((r) => r.id === id)!;

  it('lists every task statement of the exam guide in order, with title and domain', () => {
    expect(rows.map((r) => r.id)).toEqual(['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '3.1', '3.2', '3.3', '3.4', '4.1', '4.2', '5.1', '5.2']);
    expect(row('3.2').title).toMatch(/prompt engineering/i);
    expect(row('3.2').domain).toBe('D3');
  });

  it('K1 maps a task statement to planned days, written lesson days, sections and question counts', () => {
    expect(row('1.1').plannedDays).toEqual(course.days.filter((d) => d.kind === 'lesson' && d.taskStatements.includes('1.1')).map((d) => d.day));
    expect(row('1.1').lessonDays).toEqual([1, 2]);
    expect(row('1.1').questions).toBe(3);
    expect(row('1.1').sections).toEqual(['day-01#explanation', 'day-02#explanation']);
    expect(row('4.1').lessonDays).toEqual([2]);
    expect(row('4.1').questions).toBe(1);
    expect(row('5.2').lessonDays).toEqual([]);
    expect(row('5.2').plannedDays).toContain(27);
    expect(row('2.1').glossaryTerms).toBe(1);
  });

  it('K2 flags task statements with fewer than 3 questions', () => {
    expect(row('1.1').low).toBe(false);
    expect(row('4.1').low).toBe(true);
    expect(row('5.2').low).toBe(true);
    const s = coverageSummary(rows);
    expect(s.taskStatements).toBe(14);
    expect(s.low).toBe(13);
    expect(s.questions).toBe(4);
  });

  it('respects a custom threshold and ignores unknown task statements', () => {
    const r = computeCoverage({ guide: examGuide, course, lessons, questions: [...questions, q('9.9', 'day-01#x')], minQuestions: 1 });
    expect(r.find((x) => x.id === '4.1')!.low).toBe(false);
    expect(r).toHaveLength(14);
  });
});
