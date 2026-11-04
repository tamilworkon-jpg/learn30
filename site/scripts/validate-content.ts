// Learn30 content validation: every available course in the registry (src/data/courses.yaml), each with
// its own guide, plan and rules (src/courses/<id>/…; content in src/content/<collection>/<id>/). With
// AIP_FIXTURE_COURSES=1 the test-only fixture courses (tests/fixtures/courses/<id>/, registry.yaml) are
// validated too. `--final` = release gate (all days present, bank size, coverage).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { load } from 'js-yaml';
import { validateContent, type QuestionSet } from '../src/lib/validate';
import { readLookupContent, validateLookup } from '../src/lib/validate-lookup';
import { validateCourses, type CourseCard } from '../src/lib/courses';
import type { CourseRules } from '../src/lib/course-data';
import type { Course, ExamGuide, Question } from '../src/lib/types';

const root = resolve(import.meta.dirname, '..');
const abs = (p: string) => join(root, p);
const read = (p: string) => readFileSync(abs(p), 'utf8');
const list = (dir: string, ext: string) => (existsSync(abs(dir)) ? readdirSync(abs(dir)).filter((f) => f.endsWith(ext)) : []);

const final = process.argv.includes('--final');
const fixtures = process.env.AIP_FIXTURE_COURSES === '1';

interface CourseFolders {
  id: string;
  /** Folder with course.yaml, exam-guide.yaml, rules.yaml. */
  dataDir: string;
  /** src/content (collections nested per course) or a fixture course's content/ folder (flat). */
  contentRoot: string;
  nested: boolean;
}

const errors: string[] = [];
const registry = load(read('src/data/courses.yaml'));
errors.push(...validateCourses(registry).map((e) => `courses.yaml: ${e}`));
const entries: CourseCard[] = [...((registry as CourseCard[]) ?? [])];
const folders: CourseFolders[] = [];
for (const c of entries) if (c.status === 'available') folders.push({ id: c.id, dataDir: `src/courses/${c.id}`, contentRoot: 'src/content', nested: true });

if (fixtures && existsSync(abs('tests/fixtures/courses/registry.yaml'))) {
  const fx = load(read('tests/fixtures/courses/registry.yaml'));
  errors.push(...validateCourses(fx).map((e) => `fixtures registry.yaml: ${e}`));
  for (const c of (fx as CourseCard[]) ?? []) {
    if (entries.some((e) => e.id === c.id)) errors.push(`fixture course "${c.id}" duplicates a real course id`);
    folders.push({ id: c.id, dataDir: `tests/fixtures/courses/${c.id}`, contentRoot: `tests/fixtures/courses/${c.id}/content`, nested: false });
  }
}

let courses = 0;
for (const f of folders) {
  const fixture = !f.nested;
  const col = (c: string) => (f.nested ? `${f.contentRoot}/${c}/${f.id}` : `${f.contentRoot}/${c}`);
  const need = ['course.yaml', 'exam-guide.yaml', 'rules.yaml'].filter((n) => !existsSync(abs(`${f.dataDir}/${n}`)));
  if (need.length) {
    errors.push(`${f.id}: missing ${need.join(', ')} in ${f.dataDir}/`);
    continue;
  }
  courses++;
  const guide = load(read(`${f.dataDir}/exam-guide.yaml`)) as ExamGuide;
  const course = load(read(`${f.dataDir}/course.yaml`)) as Course;
  const rules = load(read(`${f.dataDir}/rules.yaml`)) as CourseRules;
  const lessons = list(col('lessons'), '.mdx').map((file) => ({ file, source: read(`${col('lessons')}/${file}`) }));
  const questionSets: QuestionSet[] = list(col('questions'), '.yaml').map((file) => ({
    set: file.replace('.yaml', ''),
    questions: (load(read(`${col('questions')}/${file}`)) as Question[]) ?? [],
  }));
  // A fixture course is a tiny test course: structure is checked, release-gate sizes are not.
  const r = validateContent({ lessons, questionSets, guide, course, rules, final: final && !fixture });
  const lookup = f.nested ? readLookupContent(abs(f.contentRoot), f.id) : readLookupContent(abs(f.contentRoot));
  r.errors.push(...validateLookup({ ...lookup, guide, course, requireAllInScope: !fixture }).errors);
  errors.push(...r.errors.map((e) => `[${f.id}] ${e}`));

  console.log(`■ ${f.id}${fixture ? ' (fixture)' : ''} — ${guide.examCode} v${guide.version} · lessons ${lessons.length}/${course.days.length} · questions ${r.totalQuestions}`);
  console.log(`  Glossary terms ${lookup.glossary.reduce((n, g) => n + g.items.length, 0)} · service cards ${lookup.services.reduce((n, s) => n + s.items.length, 0)}`);
  console.log('  Coverage (task statement → days / questions):');
  for (const [ts, c] of Object.entries(r.coverage)) console.log(`    ${ts}: days [${c.days.join(', ')}] · ${c.questions} Q`);
  if (!final && r.pending.length) console.log(`  Pending days: ${r.pending.join(', ')}`);
  for (const w of r.warnings) console.warn(`WARN [${f.id}] ${w}`);
}

for (const e of errors) console.error(`ERROR ${e}`);
console.log(errors.length ? `✗ ${errors.length} error(s)` : `✓ content valid (${courses} course${courses === 1 ? '' : 's'})`);
process.exit(errors.length ? 1 : 0);
