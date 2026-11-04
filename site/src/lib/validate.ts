import { errorText, validateLesson, validateQuestion } from '../schemas';
import { parseLesson, type ParsedLesson, type ParsedSection } from './lesson-parse';
import type { Course, ExamGuide, Question } from './types';
import type { CourseRules } from './course-data';

export { parseLesson, type ParsedLesson, type ParsedSection };

export const READING_WPM = 130;
export const LAB_MINUTES = 8;
export const MINUTES_PER_QUESTION = 1;
export const LESSON_SECTION_ORDER = ['recap', 'objectives', 'explanation', 'diagram', 'examples', 'realWorld', 'handsOn', 'examTips', 'summary', 'quiz'];
export const MOCK_SPLIT: Record<string, number> = { D1: 13, D2: 16, D3: 18, D4: 9, D5: 9 };

// Review and mock day structure — contract: specs/001-aws-ai-practitioner-course/contracts/review-and-mock-days.md
export const REVIEW_SECTION_ORDER = ['conceptMap', 'topFacts', 'traps'];
export const REVIEW_MIN_FACTS = 20;
export const REVIEW_MIN_TRAPS = 5;
export const MOCK_SECTION_ORDER: Record<number, string[]> = { 29: ['launch', 'remediation'], 30: ['launch', 'remediation', 'finalRevision', 'examStrategy'] };
export const MOCK_LAUNCHES: Record<number, number[]> = { 29: [1], 30: [2, 3] };
/** AIF-C01 defaults (src/courses/aws-ai-practitioner/rules.yaml); every course passes its own CourseRules. */
export const DEFAULT_RULES: CourseRules = {
  mock: { questions: 65, minutes: 90, passScaled: 700, count: 3 },
  mockSplit: MOCK_SPLIT,
  mockLaunches: MOCK_LAUNCHES,
  mockSectionOrder: MOCK_SECTION_ORDER,
  minQuestions: 900,
  dailyQuestions: [15, 20],
  moduleQuestions: [55, 60],
};
export const STRATEGY_TOPICS: [string, RegExp][] = [
  ['registration', /regist/i],
  ['delivery options (Pearson VUE test centre or online proctoring)', /Pearson VUE/i],
  ['90 minutes', /\b90\b/],
  ['65 questions', /\b65\b/],
  ['question types (multiple choice, multiple response, ordering, matching)', /multiple response[\s\S]*ordering[\s\S]*matching|matching[\s\S]*ordering/i],
  ['pacing', /pac(e|ing)/i],
];
const ALLOWED_COMPONENTS: Record<string, string[]> = { review: ['Section', 'Diagram', 'Callout'], mock: ['Section', 'Diagram', 'Callout', 'MockLaunch', 'Remediation'] };
const countItems = (text: string, numbered: boolean) => (text.match(numbered ? /^\s*\d+\.\s+\S/gm : /^\s*(?:[-*]|\d+\.)\s+\S/gm) ?? []).length;

/** Structure errors for a review/mock day (sections exactly in order, allowed components, required content). */
export function checkReviewOrMockDay(lesson: ParsedLesson, kind: 'review' | 'mock', day: number, rules: CourseRules = DEFAULT_RULES): string[] {
  const errors: string[] = [];
  const required = kind === 'review' ? REVIEW_SECTION_ORDER : ((rules.mockSectionOrder ?? MOCK_SECTION_ORDER)[day] ?? []);
  const types = lesson.sections.map((s) => s.type);
  if (types.join() !== required.join()) errors.push(`sections must be exactly ${required.join(' → ')} (found ${types.join(' → ') || 'none'})`);
  const ids = lesson.sections.map((s) => s.id);
  if (ids.some((id) => !/^[a-z0-9-]+$/.test(id))) errors.push('section ids must be kebab-case');
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`duplicate section ids ${[...new Set(dupes)].join(', ')}`);
  if (lesson.sections.some((s) => s.optional)) errors.push(`${kind} days have no optional sections`);
  const body = lesson.body.replace(/<Diagram\b[\s\S]*?\/>/g, '<Diagram />');
  const used = [...new Set([...body.matchAll(/<([A-Z][A-Za-z0-9]*)/g)].map((m) => m[1]))];
  const bad = used.filter((c) => !ALLOWED_COMPONENTS[kind].includes(c));
  if (bad.length) errors.push(`components not allowed on ${kind} days: ${bad.join(', ')}`);
  const sec = (t: string) => lesson.sections.find((s) => s.type === t);
  if (kind === 'review') {
    const map = sec('conceptMap');
    if (!map || countDiagrams(map.content) < 1) errors.push('review needs a concept-map diagram in the conceptMap section');
    const facts = sec('topFacts');
    if (facts && countItems(facts.content, true) < REVIEW_MIN_FACTS) errors.push(`topFacts needs ≥ ${REVIEW_MIN_FACTS} numbered facts (found ${countItems(facts.content, true)})`);
    const traps = sec('traps');
    if (traps && countItems(traps.content, false) < REVIEW_MIN_TRAPS) errors.push(`traps needs ≥ ${REVIEW_MIN_TRAPS} list items (found ${countItems(traps.content, false)})`);
  } else {
    const launch = sec('launch');
    const launched = launch ? [...launch.content.matchAll(/<MockLaunch\s+n=\{(\d)\}/g)].map((m) => Number(m[1])) : [];
    const want = rules.mockLaunches[day] ?? [];
    if (launched.join() !== want.join()) errors.push(`launch section must contain <MockLaunch n={…} /> for mock ${want.join(' and ')} (found ${launched.join(', ') || 'none'})`);
    const rem = sec('remediation');
    if (rem && !/<Remediation\s+mock=\{\d\}/.test(rem.content)) errors.push('remediation section must contain <Remediation mock={N} />');
    const strategy = sec('examStrategy');
    if (strategy) for (const [topic, re] of STRATEGY_TOPICS) if (!re.test(strategy.content)) errors.push(`examStrategy must cover ${topic}`);
  }
  return errors;
}

export interface QuestionSet {
  set: string;
  questions: Question[];
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
  /** The course's rules (src/courses/<id>/rules.yaml); defaults to AIF-C01. */
  rules?: CourseRules;
}

export interface ValidateResult {
  errors: string[];
  warnings: string[];
  pending: number[];
  coverage: Record<string, { days: number[]; questions: number }>;
  totalQuestions: number;
}

const setRule = (set: string, rules: CourseRules): [number, number] | null => {
  if (set.startsWith('day-')) return rules.dailyQuestions;
  if (set.startsWith('week-')) return rules.moduleQuestions;
  if (set.startsWith('mock-')) return [rules.mock.questions, rules.mock.questions];
  return null;
};

/**
 * Questions must test exam CONTENT (AI/ML/GenAI concepts, AWS services, responsible AI, security), never
 * the exam itself: format, question count, duration, pass mark/scoring, question types, domain weights,
 * the exam guide, study planning or retakes are not examined (learner feedback 2026-11-03).
 */
export const EXAM_META_STEM =
  /\b(exam format|format of the exam|AIF-C01|exam guide|(passing|pass) (mark|score)|scaled score|unscored|retakes?|study (time|plan)|an exam question|on the exam|for the exam|preparing for (the )?(exam|certification)|certification exam|questions? (are|is) scored|domain weight(ing)?s?|weighted domains?)\b/i;
export const isExamMetaStem = (stem: string) => EXAM_META_STEM.test(stem);
/** Options and explanations must explain the topic, not the exam: no "out of scope for the exam",
 *  "the exam guide lists…", "on the exam" or task-statement references (learner feedback 2026-11-03). */
export const EXAM_FRAMING =
  /\b(out of scope (for|in) (the|this) (v1\.2 )?(exam|guide)|exam guide|AIF-C01|guide v1\.2|v1\.2 (exam|guide|objective)|on the exam|for the exam|in the exam|the exam (tests|asks|expects|rewards|uses|loves|likes|wants|favou?rs)|exam trap|exam clues?|[Tt]ask statement \d\.\d)\b/i;
export const hasExamFraming = (text: string) => EXAM_FRAMING.test(text);

export function validateContent(input: ValidateInput): ValidateResult {
  const { guide, course, final } = input;
  const rules = input.rules ?? DEFAULT_RULES;
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
    // Mock days cover the whole exam: course.yaml lists none, the frontmatter lists all 14 task statements.
    const expectedTs = fm.kind === 'mock' ? taskIds : cd.taskStatements;
    if (JSON.stringify([...fm.taskStatements!].sort()) !== JSON.stringify([...expectedTs].sort())) {
      errors.push(`${where}: taskStatements ${fm.taskStatements} differ from ${fm.kind === 'mock' ? 'all task statements' : 'course.yaml'} ${expectedTs}`);
    }
    if (fm.kind !== 'mock') for (const ts of fm.taskStatements!) coverage[ts]?.days.push(day);
    if (fm.kind !== 'lesson') {
      const want = [...new Set(fm.taskStatements!.map((ts) => guide.domains.find((d) => d.tasks.some((t) => t.id === ts))?.id))].sort();
      const have = [...(lesson.frontmatter.domains as string[])].sort();
      if (want.join() !== have.join()) errors.push(`${where}: domains ${have.join(', ')} must be the domains of its task statements (${want.join(', ')})`);
    }

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
    } else if (fm.kind === 'review' || fm.kind === 'mock') {
      for (const e of checkReviewOrMockDay(lesson, fm.kind, day, rules)) errors.push(`${where}: ${e}`);
    }
  }

  const present = new Set(input.lessons.map((l) => parseLesson(l.source).frontmatter.day as number));
  const pending = course.days.map((d) => d.day).filter((d) => !present.has(d));
  if (final) for (const d of pending) errors.push(`Day ${d} has no content`);

  const ids = new Set<string>();
  const stems = new Map<string, string>();
  let total = 0;
  for (const { set, questions } of input.questionSets) {
    const rule = setRule(set, rules);
    if (rule && (questions.length < rule[0] || questions.length > rule[1])) {
      errors.push(`${set} has ${questions.length} questions (expected ${rule[0]}–${rule[1]})`);
    }
    if (set.startsWith('mock-')) {
      const split: Record<string, number> = {};
      for (const q of questions) split[q.domain] = (split[q.domain] ?? 0) + 1;
      if (Object.keys(rules.mockSplit).some((d) => (split[d] ?? 0) !== rules.mockSplit[d])) {
        errors.push(`${set} domain split ${JSON.stringify(split)} must be ${JSON.stringify(rules.mockSplit)}`);
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
      if (isExamMetaStem(q.stem)) errors.push(`${q.id}: asks about the exam itself (format, scoring, guide, study planning) — questions must test exam content`);
      for (const t of [q.explanation, ...q.options.flatMap((o) => [o.text, o.explanation])])
        if (t && hasExamFraming(t)) errors.push(`${q.id}: option or explanation talks about the exam instead of the topic — "${t.slice(0, 60)}…"`);
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
    if (total < rules.minQuestions) errors.push(`Question bank has ${total} questions (need ≥ ${rules.minQuestions})`);
  }

  return { errors, warnings, pending, coverage, totalQuestions: total };
}
