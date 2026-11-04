// T183 — the signed-in learner's course start date (moved out of the removed LearnerSettings in T189).
import { useEffect, useState } from 'preact/hooks';
import { useChosenStore } from './course-choice';
import { COURSE_DAYS, finishDate, formatDate, fromDateInput, toDateInput } from '../../lib/schedule';
import '../../styles/profiles.css';
import '../../styles/account.css';

/** The chosen course's start date (Learn30: each course has its own schedule). */
export default function ScheduleSettings({ courseIds }: { courseIds: string[] }) {
  const { store } = useChosenStore(courseIds);
  const [start, setStart] = useState('');
  const [ready, setReady] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    setReady(false);
    if (!store) return;
    setStart(toDateInput(new Date(store.get().startedAt)));
    setReady(true);
    const off = store.subscribe((p) => setStart(toDateInput(new Date(p.startedAt))));
    return () => {
      off();
    };
  }, [store]);

  let finishPreview = '';
  try {
    finishPreview = start ? formatDate(finishDate(fromDateInput(start))) : '';
  } catch {
    finishPreview = '';
  }

  return (
    <section class="card mt-6" id="schedule" aria-labelledby="schedule-h" data-schedule-settings data-ready={ready ? 'true' : undefined}>
      <h2 class="h2 mt-0" id="schedule-h">
        Your schedule
      </h2>
      <p class="muted mt-0 text-sm">
        Lessons are planned on weekdays only (Monday–Friday). Day 1 is your start date (or the Monday after, if you pick a weekend) and each later day is the next weekday, so the {COURSE_DAYS}-day plan takes six weeks. Dates use this device's calendar.
      </p>
      <form
        class="flex gap-2 flex-wrap items-end"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            if (!store) return;
            store.setStartDate(fromDateInput(start));
            setMsg({ kind: 'ok', text: `Start date saved. You finish on ${finishPreview}.` });
          } catch (x) {
            setMsg({ kind: 'err', text: (x as Error).message });
          }
        }}
      >
        <label class="flex flex-col text-sm font-medium">
          Start date
          <input class="schedule-input" type="date" value={start} onInput={(e) => setStart((e.target as HTMLInputElement).value)} required data-start-input />
        </label>
        <button class="btn" type="submit">
          Save start date
        </button>
        {finishPreview && (
          <span class="text-sm" data-finish-preview>
            Finish by <strong>{finishPreview}</strong>
          </span>
        )}
      </form>
      <p class={`account-msg ${msg?.kind === 'err' ? 'is-error' : msg ? 'is-ok' : ''}`} role={msg?.kind === 'err' ? 'alert' : 'status'}>
        {msg?.text ?? ''}
      </p>
    </section>
  );
}
