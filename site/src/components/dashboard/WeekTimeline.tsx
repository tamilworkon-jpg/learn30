// T073 — the current week's days as tiles with status (Phase 0 dashboard "This week").
import type { CoursePlan, PlanDay } from '../../lib/course-plan';
import { dayHref, dayStatus, type Status } from '../../lib/dashboard';
import type { Progress } from '../../lib/types';

interface Props {
  plan: CoursePlan;
  progress: Progress;
  currentDay: number;
}

function pill(d: PlanDay, s: Status, current: boolean) {
  if (s === 'completed') return '✓ Done';
  if (current) return 'Today';
  if (s === 'in-progress') return 'In progress';
  if (!d.available) return 'Soon';
  return `${d.minutes} min`;
}

export default function WeekTimeline({ plan, progress, currentDay }: Props) {
  const week = plan.weeks.find((w) => w.days.includes(currentDay)) ?? plan.weeks[0];
  return (
    <section aria-labelledby="this-week-h" data-week-timeline={week.number}>
      <div class="flex items-center justify-between mt-8 gap-3">
        <h2 class="h2 m-0" id="this-week-h">
          This week
        </h2>
        <a class="icon-btn" href="/outline" aria-label="Open course outline">
          →
        </a>
      </div>
      <ol class="week-row mt-3" role="list">
        {week.days.map((n) => {
          const d = plan.days.find((x) => x.day === n)!;
          const s = dayStatus(progress, n);
          const current = n === currentDay;
          const cls = s === 'completed' ? 'done' : current ? 'now' : '';
          return (
            <li key={n}>
              <a class={`week-tile ${cls}`} href={dayHref(n)} data-day={n} data-status={s} aria-current={current ? 'step' : undefined}>
                <span class="num-icon">{n}</span>
                <span class="tile-title text-sm font-medium">{d.title}</span>
                <span class="pill pill-accent text-[11px]">{pill(d, s, current)}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
