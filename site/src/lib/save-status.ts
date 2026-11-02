// T189 — non-blocking "Couldn't save — retrying" indicator ([data-save-status] in the top bar).
// Each syncer (progress, UI state) reports its status; the worst one wins.
import type { SyncStatus } from './api';

const sources = new Map<string, SyncStatus>();
const RANK: Record<SyncStatus, number> = { idle: 0, saved: 0, saving: 1, retrying: 2, failed: 3 };

export const SAVE_TEXT: Partial<Record<SyncStatus, string>> = {
  retrying: 'Couldn’t save — retrying',
  failed: 'Couldn’t save your latest changes',
};

export function overallStatus(): SyncStatus {
  let worst: SyncStatus = 'idle';
  sources.forEach((s) => {
    if (RANK[s] > RANK[worst]) worst = s;
  });
  return worst;
}

function render() {
  if (typeof document === 'undefined') return;
  const el = document.querySelector<HTMLElement>('[data-save-status]');
  if (!el) return;
  const s = overallStatus();
  const text = SAVE_TEXT[s] ?? '';
  el.dataset.state = s;
  if (el.textContent !== text) el.textContent = text;
}

export function reportSaveStatus(source: string, status: SyncStatus) {
  sources.set(source, status);
  render();
}

/** Test hook. */
export function resetSaveStatus() {
  sources.clear();
}
