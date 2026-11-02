// T070 — mark the day complete (or undo). Navigation to any day stays free (FR-018).
import { useEffect, useState } from 'preact/hooks';
import { getStore } from '../../lib/progress/store';
import type { DayState } from '../../lib/types';

interface Props {
  day: number;
  nextHref?: string;
}

export default function MarkComplete({ day, nextHref }: Props) {
  const [state, setState] = useState<DayState | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const store = getStore();
    const sync = () => setState(store.get().days[String(day)] ? { ...store.get().days[String(day)] } : undefined);
    sync();
    setReady(true);
    const off = store.subscribe(sync);
    return () => {
      off();
    };
  }, [day]);

  const done = state?.status === 'completed';
  const when = state?.completedAt ? new Date(state.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';

  return (
    <div class={`card mark-complete ${done ? 'is-done' : ''}`} data-mark-complete={day} data-ready={ready ? 'true' : undefined} aria-live="polite">
      {done ? (
        <>
          <p class="m-0 font-semibold">
            ✓ Day {day} completed{when && ` on ${when}`}
          </p>
          <div class="flex flex-wrap gap-2">
            {nextHref && (
              <a class="btn" href={nextHref}>
                Go to Day {day + 1} →
              </a>
            )}
            <button type="button" class="btn btn-ghost" onClick={() => getStore().unmarkDay(day)}>
              Undo
            </button>
          </div>
        </>
      ) : (
        <>
          <div>
            <p class="m-0 font-semibold">Finished today's lesson?</p>
            <p class="m-0 text-sm">Mark it complete to update your dashboard progress.</p>
          </div>
          <button type="button" class="btn" onClick={() => getStore().markDayComplete(day)}>
            ✓ Mark Day {day} complete
          </button>
        </>
      )}
    </div>
  );
}
