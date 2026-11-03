// T189 — first signed-in visit on a browser that still has pre-account progress in localStorage:
// offer "Import progress saved in this browser" once. Validation + replace reuse io.ts.
import { useEffect, useRef, useState } from 'preact/hooks';
import { isSignedIn } from '../../lib/bootstrap';
import { legacyImportOffer, rememberImportDecision, type LegacyProgress } from '../../lib/progress/legacy';
import { getStore } from '../../lib/progress/store';
import type { Progress } from '../../lib/types';
import '../../styles/account.css';

/** The account already has something an import would overwrite → ask first; a fresh account imports directly. */
const hasProgress = (p: Progress) => p.attempts.length > 0 || Object.values(p.days).some((d) => d.status !== 'not-started' || d.sectionsViewed.length > 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

function storage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

export default function ImportOffer() {
  const [offers, setOffers] = useState<LegacyProgress[]>([]);
  const [choice, setChoice] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState('');
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => setOffers(legacyImportOffer(storage(), isSignedIn())), []);
  useEffect(() => {
    if (confirming || done) panel.current?.focus();
  }, [confirming, done]);

  if (done) {
    return (
      <div class="card import-offer" data-import-offer data-state="done" ref={panel} tabIndex={-1} role="status">
        <p class="m-0">{done}</p>
      </div>
    );
  }
  if (!offers.length) return null;
  const sel = offers[Math.min(choice, offers.length - 1)];
  const s = sel.pending.summary;
  const label = (o: LegacyProgress) => {
    const t = o.pending.summary;
    return `${o.name ?? 'This browser'} — ${plural(t.daysCompleted, 'day')} completed, ${plural(t.attempts, 'quiz attempt')}, started ${fmtDate(t.startedAt)}`;
  };

  const decline = () => {
    rememberImportDecision(storage(), 'declined');
    setOffers([]);
  };
  const doImport = () => {
    sel.pending.confirm(getStore());
    rememberImportDecision(storage(), 'imported');
    setDone(`Progress imported into your account: ${plural(s.daysCompleted, 'day')} completed, ${plural(s.attempts, 'quiz attempt')}.`);
  };

  return (
    <section class="card import-offer" data-import-offer data-state={confirming ? 'confirm' : 'offer'} aria-labelledby="import-offer-h" ref={panel} tabIndex={-1}>
      <h2 class="import-offer-title" id="import-offer-h">
        Import progress saved in this browser
      </h2>
      {offers.length === 1 ? (
        <p class="m-0">
          This browser still has course progress from before accounts: {plural(s.daysCompleted, 'day')} completed, {plural(s.attempts, 'quiz attempt')}, started {fmtDate(s.startedAt)}. Import it into your account?
        </p>
      ) : (
        <fieldset class="import-choices">
          <legend>This browser has progress for more than one learner from before accounts. Which one is yours?</legend>
          {offers.map((o, i) => (
            <label key={o.key} class="import-choice">
              <input type="radio" name="import-choice" checked={i === choice} onChange={() => setChoice(i)} value={o.key} />
              <span>{label(o)}</span>
            </label>
          ))}
        </fieldset>
      )}
      {confirming ? (
        <div class="confirm-panel" data-import-offer-confirm>
          <p class="m-0 font-semibold">Replace your account's progress with this?</p>
          <p class="m-0 text-sm">Your account currently has {plural(Object.values(getStore().get().days).filter((d) => d.status === 'completed').length, 'day')} completed; it will be overwritten.</p>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn" onClick={doImport} data-import-confirm-btn>
              Replace my progress
            </button>
            <button type="button" class="btn btn-ghost" onClick={() => setConfirming(false)}>
              Back
            </button>
          </div>
        </div>
      ) : (
        <div class="flex flex-wrap gap-2 mt-3">
          <button type="button" class="btn" onClick={() => (hasProgress(getStore().get()) ? setConfirming(true) : doImport())} data-import-accept>
            Import progress…
          </button>
          <button type="button" class="btn btn-ghost" onClick={decline} data-import-decline>
            No thanks
          </button>
        </div>
      )}
    </section>
  );
}
