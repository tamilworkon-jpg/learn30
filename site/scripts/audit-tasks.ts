// T180 — final task validation.
//   A1 every completed `@visual` task has its spec's screenshots (desktop + mobile) on disk
//   A2 every completed task's referenced test files exist (and pass, with --run)
//   A3 report unchecked tasks (fail with --final, except the final-validation task T181 itself)
// Usage: npm run audit:tasks [-- --run] [-- --final]
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { isVisual, missingScreenshots, parseTasks, screenshotNames, testFilesOf } from './audit-lib';

const root = resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const tasks = parseTasks(readFileSync(resolve(root, '../specs/001-aws-ai-practitioner-course/tasks.md'), 'utf8'));
const shotsDir = join(root, 'tests/e2e/__screenshots__/review');
const pngs = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => f.endsWith('.png')) : [];
const problems: string[] = [];

const done = tasks.filter((t) => t.done);
const referenced = new Set<string>();
for (const t of done) {
  for (const file of testFilesOf(t)) {
    if (!existsSync(join(root, file))) {
      problems.push(`A2 ${t.id}: missing test file ${file}`);
      continue;
    }
    referenced.add(file);
    if (isVisual(t) && file.startsWith('tests/e2e/')) {
      for (const shot of missingScreenshots(screenshotNames(readFileSync(join(root, file), 'utf8')), pngs)) problems.push(`A1 ${t.id}: missing screenshot ${shot} (${file})`);
    }
  }
}

if (args.has('--run') && referenced.size) {
  const unit = [...referenced].filter((f) => f.startsWith('tests/unit/'));
  const e2e = [...referenced].filter((f) => f.startsWith('tests/e2e/'));
  const run = (cmd: string, files: string[]) => files.length && spawnSync(cmd, files, { cwd: root, stdio: 'inherit', shell: true }).status;
  if (run('npx vitest run', unit)) problems.push('A2 unit tests referenced by completed tasks failed');
  if (run('npx playwright test', e2e)) problems.push('A2 e2e tests referenced by completed tasks failed');
}

const open = tasks.filter((t) => !t.done);
console.log(`Tasks: ${done.length}/${tasks.length} complete · ${referenced.size} referenced test files · ${pngs.length} review screenshots`);
if (open.length) console.log(`A3 unchecked: ${open.map((t) => t.id).join(', ')}`);
if (args.has('--final')) for (const t of open.filter((t) => t.id !== 'T181')) problems.push(`A3 ${t.id} is not complete`);
for (const p of problems) console.error(p);
process.exit(problems.length ? 1 : 0);
