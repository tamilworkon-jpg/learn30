// T180 — pure helpers for scripts/audit-tasks.ts (unit-tested in tests/unit/audit-tasks.test.ts).

export interface TaskEntry {
  id: string;
  done: boolean;
  text: string; // task line + its indented sub-lines (TC / Plan / Verify / Done)
}

export function parseTasks(md: string): TaskEntry[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const tasks: TaskEntry[] = [];
  let cur: TaskEntry | null = null;
  for (const line of lines) {
    const m = /^- \[( |x)\] (T\d{3})\b(.*)$/.exec(line);
    if (m) {
      cur = { id: m[2], done: m[1] === 'x', text: line };
      tasks.push(cur);
    } else if (cur && /^\s{2,}\S/.test(line)) {
      cur.text += `\n${line}`;
    } else if (line.trim() !== '') {
      cur = null;
    }
  }
  return tasks;
}

/** Test files a task references (site/tests/... or bare tests/...). */
export function testFilesOf(task: TaskEntry): string[] {
  const files = new Set<string>();
  for (const [, f] of task.text.matchAll(/(?:site\/)?(tests\/(?:unit|e2e)\/[\w./-]+\.(?:test|spec)\.ts)/g)) files.add(f);
  return [...files];
}

export const isVisual = (task: TaskEntry) => task.text.includes('@visual');

/** Screenshot base names a spec saves via shot()/shotEl(); template parts become wildcards. */
export function screenshotNames(specSource: string): RegExp[] {
  const out: RegExp[] = [];
  for (const [, quote, name] of specSource.matchAll(/\bshot(?:El)?\([^,]+,\s*([`'"])(.+?)\1\s*\)/g)) {
    const pattern = name
      .split(/\$\{[^}]+\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join(quote === '`' ? '[\\w-]+' : '');
    out.push(new RegExp(`^${pattern}$`));
  }
  return out;
}

/** For each screenshot pattern, both projects must have at least one PNG. */
export function missingScreenshots(patterns: RegExp[], pngs: string[], projects = ['desktop', 'mobile']): string[] {
  const missing: string[] = [];
  for (const p of patterns) {
    for (const project of projects) {
      const suffix = `-${project}.png`;
      const ok = pngs.some((f) => f.endsWith(suffix) && p.test(f.slice(0, -suffix.length)));
      if (!ok) missing.push(`${p.source.replace(/^\^|\$$/g, '')}-${project}.png`);
    }
  }
  return missing;
}
