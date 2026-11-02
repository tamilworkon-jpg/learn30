import { load } from 'js-yaml';
import { errorText, validateLesson, validateQuestion } from '../schemas';
import type { Course, ExamGuide, Question } from './types';

export const READING_WPM = 130;
export const LAB_MINUTES = 8;
export const MINUTES_PER_QUESTION = 1;
export const LESSON_SECTION_ORDER = ['recap', 'objectives', 'explanation', 'diagram', 'examples', 'realWorld', 'handsOn', 'examTips', 'summary', 'quiz'];
export const MOCK_SPLIT: Record<string, number> = { D1: 13, D2: 16, D3: 18, D4: 9, D5: 9 };

export interface ParsedSection {
  id: string;
  type: string;
  optional: boolean;
  content: string;
}
export interface ParsedLesson {
  frontmatter: Record<string, unknown>;
  sections: ParsedSection[];
}
export interface QuestionSet {
  set: string;
  questions: Question[];
}

const attr = (attrs: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs)?.[1] ?? '';

export function parseLesson(source: string): ParsedLesson {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(source);
  const frontmatter = (m ? load(m[1]) : {}) as Record<string, unknown>;
  const sections: ParsedSection[] = [];
  for (const s of source.matchAll(/<Section\s+([^>]*)>([\s\S]*?)<\/Section>/g)) {
    sections.push({ id: attr(s[1], 'id'), type: attr(s[1], 'type'), optional: /\boptional\b/.test(s[1]), content: s[2] });
  }
  return { frontmatter, sections };
}

const countDiagrams = (text: string) => (text.match(/<Diagram\b/g) ?? []).length;

function countWords(text: string): number {
  const plain = text
    .replace(/<Diagram\b[\s\S]*?(?:<\/Diagram>|\/>)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_`>|-]/g, ' ');
  return plain.split(/\s+/).filter(Boolean).length;
}

export function estimateMinutes(lesson: ParsedLesson, quizQuestions = 20): number {
  const core = lesson.sections.filter((s) => !s.optional);
  const words = core.reduce((n, s) => n + countWords(s.content), 0);
  const diagrams = core.reduce((n, s) => n + countDiagrams(s.content), 0);
  return Math.round(words / READING_WPM + diagrams + LAB_MINUTES + quizQuestions * MINUTES_PER_QUESTION);
}

export interface ValidateInput {
  lessons: { file: string; source: string }[];
  questionSets: QuestionSet[];
  guide: ExamGuide;
  course: Course;
  final?: boolean;
}

export interface ValidateResult {
  errors: string[];
  warnings: string[];
  pending: number[];
  coverage: Record<string, { days: number[]; questions: number }>;
  totalQuestions: number;
}

const setRule = (set: string): [number, number] | null => {
  if (set.startsWith('day-')) return [15, 20];
  if (set.startsWith('week-')) return [55, 60];
  if (set.startsWith('mock-')) return [65, 65];
  return null;
};

export function validateContent(input: ValidateInput): ValidateResult {
  const { guide, course, final } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  const taskIds = guide.domains.flatMap((d) => d.tasks.map((t) => t.id));
  const coverage: ValidateResult['coverage'] = Object.fromEntries(taskIds.map((t) => [t, { days: [], questions: 0 }]));
  const trapNames = [...guide.outOfScopeServices, ...guide.notListed];
  const sectionsByDay = new Map<number, Set<string>>();
  const quizCount = new Map(input.questionSets.filter((s) => s.set.startsWith('day-')).map((s) => [Number(s.set.slice(4)), s.questions.length]));

  for (const { file, source } of input.lessons) {
    const lesson = parseLesson(source);
    const fm = lesson.frontmatter as { day?: number; kind?: string; taskStatements?: string[]; estimatedMinutes?: number; examTraps?: string[] };
    if (!validateLesson(fm)) {
      errors.push(`${file}: frontmatter invalid — ${errorText(validateLesson.errors)}`);
      continue;
    }
    const day = fm.day!;
    const cd = course.days.find((d) => d.day === day);
    const where = `Day ${day} (${file})`;
    sectionsByDay.set(day, new Set(lesson.sections.map((s) => s.id)));
    if (!cd) {
      errors.push(`${where}: not in course.yaml`);
      continue;
    }
    if (cd.kind !== fm.kind) errors.push(`${where}: kind ${fm.kind} but course.yaml says ${cd.kind}`);
    if (JSON.stringify([...fm.taskStatements!].sort()) !== JSON.stringify([...cd.taskStatements].sort())) {
      errors.push(`${where}: taskStatements ${fm.taskStatements} differ from course.yaml ${cd.taskStatements}`);
    }
    for (const ts of fm.taskStatements!) coverage[ts]?.days.push(day);

    const text = source;
    for (const name of trapNames) {
      if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text) && !fm.examTraps?.includes(name)) {
        errors.push(`${where}: mentions "${name}" (not in exam scope) without an examTraps entry`);
      }
    }

    if (fm.kind === 'lesson') {
      const required = LESSON_SECTION_ORDER.map((t) => (t === 'recap' && day === 1 ? 'orientation' : t));
      const core = lesson.sections.filter((s) => !s.optional).map((s) => s.type);
      for (const t of required) if (!core.includes(t)) errors.push(`${where}: missing section "${t}"`);
      const present = required.filter((t) => core.includes(t));
      const actual = core.filter((t) => required.includes(t));
      if (present.join() !== actual.join()) errors.push(`${where}: sections out of order (${actual.join(' → ')})`);
      const coreText = lesson.sections.filter((s) => !s.optional).map((s) => s.content).join('\n');
      if (countDiagrams(coreText) < 1) errors.push(`${where}: needs at least one diagram`);
      const deep = lesson.sections.find((s) => s.type === 'deepDive');
      if (!deep) errors.push(`${where}: missing deepDive section`);
      else {
        if (countDiagrams(deep.content) < 1) errors.push(`${where}: deepDive needs an architecture diagram`);
        if (!deep.optional) errors.push(`${where}: deepDive must be marked optional`);
        if (lesson.sections.at(-1) !== deep) errors.push(`${where}: deepDive must be the last section`);
      }
      const idList = lesson.sections.map((s) => s.id);
      const dupes = idList.filter((id, i) => idList.indexOf(id) !== i);
      if (dupes.length) errors.push(`${where}: duplicate section ids ${[...new Set(dupes)].join(', ')}`);
      const est = estimateMinutes(lesson, quizCount.get(day) ?? 20);
      if (est < 50 || est > 70) errors.push(`${where}: estimated core minutes ${est} outside 50–70`);
      const declared = fm.estimatedMinutes!;
      if (Math.abs(est - declared) / declared > 0.15) errors.push(`${where}: estimated ${est} min is >15% off declared ${declared}`);
    } else if (fm.kind === 'review') {
      if (countDiagrams(source) < 1) errors.push(`${where}: review needs a concept-map diagram`);
    }
  }

  const present = new Set(input.lessons.map((l) => parseLesson(l.source).frontmatter.day as number));
  const pending = course.days.map((d) => d.day).filter((d) => !present.has(d));
  if (final) for (const d of pending) errors.push(`Day ${d} has no content`);

  const ids = new Set<string>();
  const stems = new Map<string, string>();
  let total = 0;
  for (const { set, questions } of input.questionSets) {
    const rule = setRule(set);
    if (rule && (questions.length < rule[0] || questions.length > rule[1])) {
      errors.push(`${set} has ${questions.length} questions (expected ${rule[0]}–${rule[1]})`);
    }
    if (set.startsWith('mock-')) {
      const split: Record<string, number> = {};
      for (const q of questions) split[q.domain] = (split[q.domain] ?? 0) + 1;
      if (Object.keys(MOCK_SPLIT).some((d) => (split[d] ?? 0) !== MOCK_SPLIT[d])) {
        errors.push(`${set} domain split ${JSON.stringify(split)} must be ${JSON.stringify(MOCK_SPLIT)}`);
      }
    }
    for (const q of questions) {
      total++;
      if (!validateQuestion(q)) errors.push(`${q.id ?? set}: schema — ${errorText(validateQuestion.errors)}`);
      if (ids.has(q.id)) errors.push(`Duplicate id ${q.id}`);
      ids.add(q.id);
      const stemKey = q.stem.trim().toLowerCase();
      const prevSet = stems.get(stemKey);
      if (prevSet && prevSet !== set) errors.push(`${q.id}: stem reused from ${prevSet}`);
      stems.set(stemKey, set);
      const optionIds = new Set(q.options.map((o) => o.id));
      const keys = Array.isArray(q.answer) ? q.answer : Object.keys(q.answer);
      if (keys.some((k) => !optionIds.has(k))) errors.push(`${q.id}: answer references unknown option`);
      if (q.type === 'ordering' && (!Array.isArray(q.answer) || q.answer.length !== optionIds.size || new Set(q.answer).size !== optionIds.size)) {
        errors.push(`${q.id}: ordering answer must be a permutation of all options`);
      }
      if (q.type === 'matching') {
        const targets = new Set((q.matchTargets ?? []).map((t) => t.id));
        const pairs = Array.isArray(q.answer) ? {} : q.answer;
        if (Object.keys(pairs).length !== optionIds.size || Object.values(pairs).some((t) => !targets.has(t))) {
          errors.push(`${q.id}: matching answer must pair every option with a valid target`);
        }
      }
      const [refDay, refSection] = q.lessonRef.split('#');
      const secs = sectionsByDay.get(Number(refDay.slice(4)));
      if (!secs || !secs.has(refSection)) errors.push(`${q.id}: lessonRef ${q.lessonRef} does not resolve`);
      if (coverage[q.taskStatement]) coverage[q.taskStatement].questions++;
      else errors.push(`${q.id}: unknown task statement ${q.taskStatement}`);
    }
  }

  if (final) {
    for (const [ts, c] of Object.entries(coverage)) if (c.questions < 3) errors.push(`Task statement ${ts} has fewer than 3 questions`);
    if (total < 900) errors.push(`Question bank has ${total} questions (need ≥ 900)`);
  }

  return { errors, warnings, pending, coverage, totalQuestions: total };
}
