import type { Course, DomainId, ExamGuide } from './types';

/** Minimum questions per task statement before the coverage matrix (and `validate --final`) flags it. */
export const MIN_QUESTIONS_PER_TS = 3;

export interface CoverageInput {
  guide: ExamGuide;
  course: Course;
  /** Lessons that exist (frontmatter day + task statements). */
  lessons: { day: number; taskStatements: string[] }[];
  questions: { taskStatement: string; lessonRef: string }[];
  glossary?: { taskStatements: string[] }[];
  minQuestions?: number;
}

export interface CoverageRow {
  id: string;
  title: string;
  domain: DomainId;
  /** Lesson days that teach this task statement per course.yaml (research.md A5). */
  plannedDays: number[];
  /** Planned or other days whose lesson file exists and lists this task statement. */
  lessonDays: number[];
  /** Distinct lesson sections the questions for this task statement point back to. */
  sections: string[];
  questions: number;
  glossaryTerms: number;
  /** Fewer than `minQuestions` questions. */
  low: boolean;
}

/** Task statement → lessons, sections and question counts (US6 coverage matrix; mirrors `validateContent().coverage`). */
export function computeCoverage(input: CoverageInput): CoverageRow[] {
  const min = input.minQuestions ?? MIN_QUESTIONS_PER_TS;
  return input.guide.domains.flatMap((d) =>
    d.tasks.map((t) => {
      const qs = input.questions.filter((q) => q.taskStatement === t.id);
      return {
        id: t.id,
        title: t.title,
        domain: d.id,
        plannedDays: input.course.days.filter((cd) => cd.kind === 'lesson' && cd.taskStatements.includes(t.id)).map((cd) => cd.day),
        lessonDays: input.lessons
          .filter((l) => l.taskStatements.includes(t.id))
          .map((l) => l.day)
          .sort((a, b) => a - b),
        sections: [...new Set(qs.map((q) => q.lessonRef))].sort(),
        questions: qs.length,
        glossaryTerms: (input.glossary ?? []).filter((g) => g.taskStatements.includes(t.id)).length,
        low: qs.length < min,
      };
    }),
  );
}

export function coverageSummary(rows: CoverageRow[]) {
  return {
    taskStatements: rows.length,
    low: rows.filter((r) => r.low).length,
    questions: rows.reduce((n, r) => n + r.questions, 0),
    withLessons: rows.filter((r) => r.lessonDays.length > 0).length,
  };
}
