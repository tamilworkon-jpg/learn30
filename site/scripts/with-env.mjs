/* global process, console */
// Cross-platform `KEY=VALUE … -- command` (no extra dependency). Used by `npm run build:e2e` to include
// the test-only fixture courses (AIP_FIXTURE_COURSES=1, spec 002). The command runs in a shell.
import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const sep = args.indexOf('--');
if (sep < 0 || sep === args.length - 1) {
  console.error('usage: node scripts/with-env.mjs KEY=VALUE … -- command');
  process.exit(2);
}
const env = { ...process.env };
for (const pair of args.slice(0, sep)) {
  const i = pair.indexOf('=');
  if (i < 1) {
    console.error(`with-env: bad pair "${pair}"`);
    process.exit(2);
  }
  env[pair.slice(0, i)] = pair.slice(i + 1);
}
const child = spawn(args.slice(sep + 1).join(' '), { stdio: 'inherit', shell: true, env });
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
