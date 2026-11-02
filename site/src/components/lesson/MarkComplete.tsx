// T070 — mark the day complete (or undo). Navigation to any day stays free (FR-018).
// T112 — completing a day updates the streak (store) and badges, and shows a celebration.
import { useCallback, useEffect, useState } from 'preact/hooks';
import { earnedBadges, newBadges, type BadgeWeek } from '../../lib/badges';
import { getStore } from '../../lib/progress/store';
import { currentStreak, localDate } from '../../lib/streak';
import type { DayState } from '../../lib/types';
import Celebrate from '../common/Celebrate';

interface Props {
  day: number;
  nextHref?: string;
  weeks: BadgeWeek[];
  totalDays: number;
}

interface Party {
  streak: number;
  badges: string[];
}

export default function MarkComplete({ day, nextHref, weeks, totalDays }: Props) {
  const [state, setState] = useState<DayState | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const [party, setParty] = useState<Party | null>(null);

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

  const complete = () => {
    const store = getStore();
    const before = [...store.get().badges];
    store.markDayComplete(day);
    const earned = earnedBadges(store.get(), weeks, totalDays);
    store.awardBadges(earned);
    setParty({ streak: currentStreak(store.get().streak, localDate()), badges: newBadges(before, earned) });
  };
  const close = useCallback(() => setParty(null), []);

  const done = state?.status === 'completed';
  const when = state?.completedAt ? new Date(state.completedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';

  return (
    <>
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
              <p class="m-0 text-sm">Mark it complete to update your dashboard progress and streak.</p>
            </div>
            <button type="button" class="btn" onClick={complete}>
              ✓ Mark Day {day} complete
            </button>
          </>
        )}
      </div>
      {party && <Celebrate title={`Day ${day} complete!`} streak={party.streak} badges={party.badges} onClose={close} />}
    </>
  );
}
