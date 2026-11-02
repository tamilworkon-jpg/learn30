// T074 — "Focus areas": domains under 70% (≥5 answered, latest attempts) with revisit links.
import type { CoursePlan } from '../../lib/course-plan';
import { dayHref, dayStatus } from '../../lib/dashboard';
import type { Progress } from '../../lib/types';
import { weakDomains } from '../../lib/weak-domains';

interface Props {
  plan: CoursePlan;
  progress: Progress;
}

export default function WeakDomains({ plan, progress }: Props) {
  const weak = weakDomains(progress.attempts, plan, plan.domains);
  return (
    <div class="card" data-weak-domains>
      <h3 class="font-semibold m-0 mb-1">Focus areas</h3>
      <p class="muted text-sm m-0 mb-2">From your latest quiz results</p>
      {progress.attempts.length === 0 ? (
        <p class="text-sm m-0">Take a daily quiz and your weakest exam domains will show up here.</p>
      ) : weak.length === 0 ? (
        <p class="text-sm m-0">No weak domains — every domain you have practised is at 70% or more. 🎉</p>
      ) : (
        <ul class="weak-list" role="list">
          {weak.map((w) => {
            // Prefer days the learner has already studied, then the next available ones.
            const days = [...w.days].sort((a, b) => Number(dayStatus(progress, a) === 'not-started') - Number(dayStatus(progress, b) === 'not-started') || a - b).slice(0, 3);
            return (
              <li key={w.domain} data-domain={w.domain}>
                <span class={`chip chip-${w.domain}`} title={w.name}>
                  {w.domain} · {w.percent}%
                </span>
                <span class="sr-only">
                  {w.name}: {w.correct} of {w.total} correct.
                </span>
                <span class="weak-revisit text-sm">
                  Revisit:{' '}
                  {days.map((n, i) => (
                    <>
                      {i > 0 && ' · '}
                      <a href={dayHref(n)}>Day {n}</a>
                    </>
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
