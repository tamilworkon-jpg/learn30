import validateProgress from '../../schemas/generated/validate-progress';
import type { Progress } from '../types';
import type { Store } from './store';

const errorText = (errors: typeof validateProgress.errors) =>
  (errors ?? []).slice(0, 3).map((e) => `${e.instancePath || '(root)'} ${e.message}`).join('; ');

export const MAX_IMPORT_BYTES = 1024 * 1024;

export function exportProgress(p: Progress): string {
  return JSON.stringify(p, null, 2);
}

export function downloadProgress(p: Progress) {
  const blob = new Blob([exportProgress(p)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `aip-progress-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export type ImportResult =
  | { ok: true; summary: { daysCompleted: number; attempts: number; startedAt: string }; confirm: (store: Store) => void }
  | { ok: false; error: string };

export function prepareImport(text: string): ImportResult {
  if (new Blob([text]).size > MAX_IMPORT_BYTES) return { ok: false, error: 'That file is larger than 1 MB, so it cannot be a progress file.' };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'That file is not valid JSON. Please choose a file exported from this site.' };
  }
  if (!validateProgress(data)) {
    return { ok: false, error: `This does not look like a progress file for this course (${errorText(validateProgress.errors)}).` };
  }
  const p = data as Progress;
  return {
    ok: true,
    summary: {
      daysCompleted: Object.values(p.days).filter((d) => d.status === 'completed').length,
      attempts: p.attempts.length,
      startedAt: p.startedAt,
    },
    confirm: (store) => store.replace(p),
  };
}
