import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load } from 'js-yaml';
import { validateContent, type QuestionSet } from '../src/lib/validate';
import { readLookupContent, validateLookup } from '../src/lib/validate-lookup';
import { validateCourses } from '../src/lib/courses';
import type { Course, ExamGuide, Question } from '../src/lib/types';

const root = resolve(import.meta.dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const list = (dir: string, ext: string) => (existsSync(join(root, dir)) ? readdirSync(join(root, dir)).filter((f) => f.endsWith(ext)) : []);

const guide = load(read('src/data/exam-guide.yaml')) as ExamGuide;
const course = load(read('src/data/course.yaml')) as Course;
const lessons = list('src/content/lessons', '.mdx').map((file) => ({ file, source: read(`src/content/lessons/${file}`) }));
const questionSets: QuestionSet[] = list('src/content/questions', '.yaml').map((file) => ({
  set: file.replace('.yaml', ''),
  questions: (load(read(`src/content/questions/${file}`)) as Question[]) ?? [],
}));

const final = process.argv.includes('--final');
const r = validateContent({ lessons, questionSets, guide, course, final });
// Glossary + service cards (K9/K10).
const lookup = readLookupContent(join(root, 'src/content'));
r.errors.push(...validateLookup({ ...lookup, guide, course, requireAllInScope: true }).errors);
r.errors.push(...validateCourses(load(readFileSync(join(root, 'src/data/courses.yaml'), 'utf8'))).map((e) => `courses.yaml: ${e}`));

console.log(`Exam guide ${guide.examCode} v${guide.version} · lessons ${lessons.length}/30 · questions ${r.totalQuestions}`);
console.log(`Glossary terms ${lookup.glossary.reduce((n, f) => n + f.items.length, 0)} · service cards ${lookup.services.reduce((n, f) => n + f.items.length, 0)}`);
console.log('Coverage (task statement → days / questions):');
for (const [ts, c] of Object.entries(r.coverage)) console.log(`  ${ts}: days [${c.days.join(', ')}] · ${c.questions} Q`);
if (!final && r.pending.length) console.log(`Pending days: ${r.pending.join(', ')}`);
for (const w of r.warnings) console.warn(`WARN ${w}`);
for (const e of r.errors) console.error(`ERROR ${e}`);
console.log(r.errors.length ? `✗ ${r.errors.length} error(s)` : '✓ content valid');
process.exit(r.errors.length ? 1 : 0);
