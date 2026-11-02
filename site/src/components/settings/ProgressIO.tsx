// T077 — export / import / reset progress. Import and reset both need a second, explicit confirmation.
import { useEffect, useRef, useState } from 'preact/hooks';
import { downloadProgress, MAX_IMPORT_BYTES, prepareImport, type ImportResult } from '../../lib/progress/io';
import { getStore } from '../../lib/progress/store';
import type { Progress } from '../../lib/types';

type Pending = Extract<ImportResult, { ok: true }>;

const completed = (p: Progress) => Object.values(p.days).filter((d) => d.status === 'completed').length;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export default function ProgressIO() {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [recovered, setRecovered] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const store = getStore();
    setProgress({ ...store.get() });
    setRecovered(store.recovered);
    const off = store.subscribe((p) => setProgress({ ...p }));
    return () => {
      off();
    };
  }, []);

  // Move focus into a confirmation panel when it opens.
  useEffect(() => {
    if (pending || confirmReset) dialogRef.current?.focus();
  }, [pending, confirmReset]);

  const clear = () => {
    setStatus('');
    setError('');
  };

  const onExport = () => {
    clear();
    downloadProgress(getStore().get());
    setStatus('Progress exported. Keep the file somewhere safe — you can import it on another device or address.');
  };

  const onFile = async (e: Event) => {
    clear();
    setConfirmReset(false);
    setPending(null);
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow choosing the same file again
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setError('That file is larger than 1 MB, so it cannot be a progress file.');
      return;
    }
    const result = prepareImport(await file.text());
    if (result.ok) setPending(result);
    else setError(result.error);
  };

  const confirmImport = () => {
    if (!pending) return;
    pending.confirm(getStore());
    setPending(null);
    setStatus(`Progress imported: ${plural(pending.summary.daysCompleted, 'day')} completed, ${plural(pending.summary.attempts, 'quiz attempt')}.`);
    fileRef.current?.focus();
  };

  const doReset = () => {
    getStore().reset();
    setConfirmReset(false);
    setStatus('Progress reset. Your dashboard now starts again from Day 1.');
  };

  return (
    <div class="progress-io" data-progress-io data-ready={progress ? 'true' : undefined}>
      {recovered && (
        <p class="card callout-examTrap m-0" role="alert">
          Your saved progress could not be read, so a fresh start was created.
        </p>
      )}

      <p class={`io-status ${status ? 'has-status' : ''}`} role="status">
        {status}
      </p>

      <section class="card" aria-labelledby="io-export-h">
        <h2 class="h2" id="io-export-h">
          Export
        </h2>
        <p class="mt-0">
          Download your progress as a JSON file
          {progress && (
            <>
              {' '}
              (currently <strong>{plural(completed(progress), 'day')} completed</strong>, {plural(progress.attempts.length, 'quiz attempt')})
            </>
          )}
          .
        </p>
        <button type="button" class="btn" onClick={onExport}>
          Export progress
        </button>
      </section>

      <section class="card" aria-labelledby="io-import-h">
        <h2 class="h2" id="io-import-h">
          Import
        </h2>
        <p class="mt-0">Load a file exported from this site. You will see a summary and must confirm before anything is replaced.</p>
        <label class="btn btn-outline file-btn" for="io-import-file">
          Import progress file
        </label>
        <input ref={fileRef} class="file-input" id="io-import-file" type="file" accept="application/json,.json" onChange={onFile} />
        {error && (
          <p class="io-error" role="alert">
            {error}
          </p>
        )}
        {pending && (
          <div class="confirm-panel" data-import-confirm ref={dialogRef} tabIndex={-1} role="group" aria-labelledby="io-import-confirm-h">
            <h3 class="m-0 font-semibold" id="io-import-confirm-h">
              Replace your progress with this file?
            </h3>
            <ul class="m-0">
              <li>{plural(pending.summary.daysCompleted, 'day')} completed</li>
              <li>{plural(pending.summary.attempts, 'quiz attempt')}</li>
              <li>Started {fmtDate(pending.summary.startedAt)}</li>
            </ul>
            {progress && <p class="m-0 text-sm">Your current progress ({plural(completed(progress), 'day')} completed) will be overwritten.</p>}
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn" onClick={confirmImport}>
                Replace my progress
              </button>
              <button type="button" class="btn btn-ghost" onClick={() => setPending(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      <section class="card" aria-labelledby="io-reset-h">
        <h2 class="h2" id="io-reset-h">
          Reset
        </h2>
        <p class="mt-0">Clear all completed days, quiz attempts, streaks and badges in your account.</p>
        {confirmReset ? (
          <div class="confirm-panel danger" data-reset-confirm ref={dialogRef} tabIndex={-1} role="group" aria-labelledby="io-reset-confirm-h">
            <h3 class="m-0 font-semibold" id="io-reset-confirm-h">
              Delete all progress? This cannot be undone.
            </h3>
            <p class="m-0 text-sm">Tip: export first if you might want it back.</p>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="btn btn-danger" onClick={doReset}>
                Yes, delete all progress
              </button>
              <button type="button" class="btn btn-ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            class="btn btn-outline"
            onClick={() => {
              clear();
              setPending(null);
              setConfirmReset(true);
            }}
          >
            Reset progress…
          </button>
        )}
      </section>

    </div>
  );
}
