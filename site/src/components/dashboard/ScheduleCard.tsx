// T183 — the learner's plan dates from the browser's current date: start, finish, today's plan day, ahead/behind.
import { COURSE_DAYS, finishDate, formatDate, isStudyDay, plannedDate, projectedFinish, scheduleStatus } from '../../lib/schedule';

interface Props {
  startedAt: string;
  completed: number;
  now?: Date;
}

export default function ScheduleCard({ startedAt, completed, now = new Date() }: Props) {
  const start = new Date(startedAt);
  const s = scheduleStatus(start, now, completed);
  const n = Math.abs(s.delta);
  const label =
    s.state === 'not-started'
      ? `Starts ${formatDate(plannedDate(start, 1))}`
      : completed >= COURSE_DAYS
        ? 'Course complete 🎉'
        : s.state === 'ahead'
          ? `${n} day${n === 1 ? '' : 's'} ahead`
          : s.state === 'behind'
            ? `${n} day${n === 1 ? '' : 's'} behind`
            : 'On track';
  // Recomputed on every dashboard load from completed days + today's date (no background job).
  const projected = projectedFinish(start, now, completed);
  const original = finishDate(start);
  const shift = s.state === 'not-started' ? 0 : -s.delta;
  const projectedNote = projected === null ? 'All 30 days done' : shift > 0 ? `${shift} study day${shift === 1 ? '' : 's'} later than planned` : shift < 0 ? `${-shift} study day${shift === -1 ? '' : 's'} earlier than planned` : 'Same as planned';
  const today =
    s.planDay < 1
      ? 'Before Day 1'
      : s.planDay > COURSE_DAYS
        ? 'Plan finished'
        : isStudyDay(now)
          ? `Day ${s.planDay} of your plan`
          : `Weekend · Day ${s.planDay} on ${formatDate(plannedDate(start, s.planDay))}`;
  return (
    <section class="card schedule-card" data-schedule aria-label="Your 30-day plan (weekdays only)">
      <div class="sched-item">
        <span class="sched-label">Started</span>
        <span class="sched-value" data-sched-start>
          {formatDate(plannedDate(start, 1))}
        </span>
      </div>
      <div class="sched-item">
        <span class="sched-label">Original finish</span>
        <span class="sched-value" data-sched-finish>
          {formatDate(original)}
        </span>
      </div>
      <div class="sched-item">
        <span class="sched-label">Updated finish (your pace)</span>
        <span class="sched-value" data-sched-projected data-shift={shift}>
          {projected ? formatDate(projected) : 'Finished'}
        </span>
        <span class="sched-note" data-sched-projected-note>
          {projectedNote}
        </span>
      </div>
      <div class="sched-item">
        <span class="sched-label">Today ({formatDate(now)})</span>
        <span class="sched-value" data-sched-today>
          {today}
        </span>
      </div>
      <span class="sched-state" data-state={completed >= COURSE_DAYS ? 'on-track' : s.state} data-sched-status>
        {label}
      </span>
      <a class="text-sm" href="/settings#schedule">
        Change start date
      </a>
    </section>
  );
}
