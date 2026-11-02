// T075 — dashboard island: reads progress from localStorage after mount (static page) and lays out
// the Phase 0 dashboard: continue cards + this week (main), progress ring + focus areas (side).
import { useEffect, useState } from 'preact/hooks';
import type { CoursePlan } from '../../lib/course-plan';
import { completedCount, continueTarget, percentComplete } from '../../lib/dashboard';
import { defaultProgress, getStore } from '../../lib/progress/store';
import type { Progress } from '../../lib/types';
import ContinueCard from './ContinueCard';
import ProgressRing from './ProgressRing';
import WeakDomains from './WeakDomains';
import WeekTimeline from './WeekTimeline';

interface Props {
  plan: CoursePlan;
}

export default function Dashboard({ plan }: Props) {
  const [progress, setProgress] = useState<Progress>(() => defaultProgress());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const store = getStore();
    // Spread so Preact sees a new object on every store change.
    setProgress({ ...store.get() });
    setReady(true);
    const off = store.subscribe((p) => setProgress({ ...p }));
    return () => {
      off();
    };
  }, []);

  const target = continueTarget(progress, plan);
  const day = plan.days.find((d) => d.day === target.day)!;
  const week = plan.weeks.find((w) => w.number === day.week)!;
  const started = Object.keys(progress.days).length > 0 || progress.attempts.length > 0;

  return (
    <div class="dash" data-dashboard data-ready={ready ? 'true' : undefined}>
      <section>
        <h1 class="h1">{started ? 'Welcome back 👋' : 'Welcome 👋'}</h1>
        <p class="muted mt-0">
          Day {day.day} of {plan.days.length} · Week {week.number} — {week.title}
        </p>

        <h2 class="h2 mt-6">{target.resumed ? 'Continue where you left off' : started ? 'Up next' : 'Start here'}</h2>
        <ContinueCard plan={plan} progress={progress} />
        <WeekTimeline plan={plan} progress={progress} currentDay={day.day} />
      </section>

      <aside class="side" aria-label="Your progress">
        <ProgressRing percent={percentComplete(progress, plan)} completed={completedCount(progress, plan)} total={plan.days.length} />
        <WeakDomains plan={plan} progress={progress} />
      </aside>
    </div>
  );
}
