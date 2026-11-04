// T073 — the learner's current study week (five lesson days, Mon–Fri) as tiles with status.
import type { CoursePlan, PlanDay } from '../../lib/course-plan';
import { dayHref, dayStatus, type Status } from '../../lib/dashboard';
import { STUDY_WEEKS, formatDate, plannedDate, studyWeekDays, studyWeekOf } from '../../lib/schedule';
import type { Progress } from '../../lib/types';
import { courseHref, DEFAULT_COURSE_ID } from '../../lib/routes';

interface Props {
  plan: CoursePlan;
  progress: Progress;
  currentDay: number;
  courseId?: string;
}

function pill(d: PlanDay, s: Status, current: boolean) {
  if (s === 'completed') return '✓ Done';
  if (current) return 'Up next'; // the learner's next lesson (the plan's "today" is on the schedule card)
  if (s === 'in-progress') return 'In progress';
  if (!d.available) return 'Soon';
  return `${d.minutes} min`;
}

export default function WeekTimeline({ plan, progress, currentDay, courseId = DEFAULT_COURSE_ID }: Props) {
  const start = new Date(progress.startedAt);
  const studyWeek = studyWeekOf(currentDay);
  // Only days the course has (a course may be shorter than six full weeks).
  const days = studyWeekDays(studyWeek).filter((n) => plan.days.some((x) => x.day === n));
  const first = plannedDate(start, days[0]);
  const last = plannedDate(start, days[days.length - 1]);
  const range = `${formatDate(first).replace(/,? \d{4}$/, '')} – ${formatDate(last)}`;
  return (
    <section aria-labelledby="this-week-h" data-week-timeline={studyWeek}>
      <div class="flex items-center justify-between mt-8 gap-3">
        <h2 class="h2 m-0" id="this-week-h">
          This week <span class="muted text-sm font-normal">· Week {studyWeek} of {STUDY_WEEKS} · Mon–Fri · {range}</span>
        </h2>
        <a class="icon-btn" href={courseHref(courseId, 'outline')} aria-label="Open course outline">
          →
        </a>
      </div>
      <ol class="week-row mt-3" role="list">
        {days.map((n) => {
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
