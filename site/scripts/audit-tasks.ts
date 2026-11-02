import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// T180 will extend this; for now it reports task completion and verifies referenced test files exist.
const root = resolve(import.meta.dirname, '..');
const tasks = readFileSync(resolve(root, '../specs/001-aws-ai-practitioner-course/tasks.md'), 'utf8');
const lines = [...tasks.matchAll(/^- \[( |x)\] (T\d{3})(.*)$/gm)];
const done = lines.filter((l) => l[1] === 'x');
const missing: string[] = [];
for (const [, , id, rest] of done) {
  for (const [, file] of rest.matchAll(/site\/(tests\/[\w/.-]+\.ts)/g)) {
    if (!existsSync(join(root, file))) missing.push(`${id}: ${file}`);
  }
}
console.log(`Tasks: ${done.length}/${lines.length} complete`);
for (const m of missing) console.error(`MISSING test file ${m}`);
process.exit(missing.length ? 1 : 0);
