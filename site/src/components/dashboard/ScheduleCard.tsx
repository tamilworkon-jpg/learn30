// T183 — the learner's plan dates from the browser's current date: start, finish, today's plan day, ahead/behind.
import { COURSE_DAYS, finishDate, formatDate, scheduleStatus } from '../../lib/schedule';

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
      ? `Starts ${formatDate(start)}`
      : completed >= COURSE_DAYS
        ? 'Course complete 🎉'
        : s.state === 'ahead'
          ? `${n} day${n === 1 ? '' : 's'} ahead`
          : s.state === 'behind'
            ? `${n} day${n === 1 ? '' : 's'} behind`
            : 'On track';
  const today = s.planDay < 1 ? 'Before Day 1' : s.planDay > COURSE_DAYS ? 'Plan finished' : `Day ${s.planDay}`;
  return (
    <section class="card schedule-card" data-schedule aria-label="Your 30-day plan">
      <div class="sched-item">
        <span class="sched-label">Started</span>
        <span class="sched-value" data-sched-start>
          {formatDate(start)}
        </span>
      </div>
      <div class="sched-item">
        <span class="sched-label">Finish by</span>
        <span class="sched-value" data-sched-finish>
          {formatDate(finishDate(start))}
        </span>
      </div>
      <div class="sched-item">
        <span class="sched-label">Today ({formatDate(now)})</span>
        <span class="sched-value" data-sched-today>
          {today} of your plan
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
