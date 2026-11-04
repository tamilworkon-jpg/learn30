// Courses page: one card per course in src/data/courses.yaml. Signed in, the available course shows the
// learner's progress (read from the progress store after mount); signed out, it invites sign-in.
import { useEffect, useState } from 'preact/hooks';
import { isSignedIn } from '../../lib/bootstrap';
import type { CoursePlan } from '../../lib/course-plan';
import type { CourseCard } from '../../lib/courses';
import { completedCount, continueTarget, percentComplete } from '../../lib/dashboard';
import { getStore } from '../../lib/progress/store';
import { formatDate, projectedFinish } from '../../lib/schedule';
import type { Progress } from '../../lib/types';
import '../../styles/courses.css';

interface Props {
  courses: CourseCard[];
  /** The plan of the course whose pages are this site's routes (course #1). */
  plan: CoursePlan;
}

export default function CourseCards({ courses, plan }: Props) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);

  useEffect(() => {
    const inn = isSignedIn();
    setSignedIn(inn);
    if (!inn) return;
    const store = getStore();
    setProgress({ ...store.get() });
    return store.subscribe((p) => setProgress({ ...p }));
  }, []);

  return (
    <ul class="course-grid" role="list" data-courses data-ready={signedIn === null ? undefined : 'true'}>
      {courses.map((c, i) => {
        const tracked = i === 0 && c.status === 'available' && signedIn && progress;
        const done = tracked ? completedCount(progress, plan) : 0;
        const pct = tracked ? percentComplete(progress, plan) : 0;
        const started = tracked ? Object.keys(progress.days).length > 0 || progress.attempts.length > 0 : false;
        const target = tracked ? continueTarget(progress, plan) : null;
        const finish = tracked ? projectedFinish(new Date(progress.startedAt), new Date(), done) : null;
        return (
          // The strict CSP blocks style attributes in the HTML: the accent is applied through the CSSOM after mount.
          <li key={c.id} class="course-card-item card" data-course={c.id} ref={(el) => el?.style.setProperty('--course-accent', c.accent)}>
            <div class="course-card-top">
              <img class="course-illo" src={c.illustration} alt="" width={72} height={72} />
              <div class="course-head">
                <p class="course-chips m-0">
                  <span class="chip course-code">{c.examCode}</span>
                  <span class="pill pill-soft">{c.level}</span>
                  {c.status === 'coming-soon' && <span class="pill pill-soon">Coming soon</span>}
                </p>
                <h2 class="course-title">{c.title}</h2>
                <p class="muted text-sm m-0">
                  {c.provider} · {c.lengthDays} days · ~{c.hoursPerDay} h/day · weekdays
                </p>
              </div>
            </div>
            <p class="course-desc">{c.description}</p>

            {c.status === 'available' && signedIn && tracked && (
              <div class="course-progress" data-course-progress>
                <progress class="course-bar" max={100} value={pct} aria-label={`${c.shortTitle} progress: ${pct}%`}></progress>
                <p class="text-sm m-0">
                  <strong>
                    {done} of {plan.days.length} days
                  </strong>{' '}
                  · {pct}%{target && done < plan.days.length ? ` · next: Day ${target.day}` : ''}
                  {finish ? ` · finish ${formatDate(finish)}` : done >= plan.days.length ? ' · course complete 🎉' : ''}
                </p>
              </div>
            )}
            {c.status === 'available' && signedIn === false && <p class="text-sm muted m-0">Sign in to track your progress and pick up where you left off.</p>}

            {c.status === 'available' && (
              <p class="course-actions m-0">
                {signedIn === false ? (
                  <a class="btn" href={`/login?next=${encodeURIComponent(c.entryHref)}`}>
                    Sign in to start →
                  </a>
                ) : (
                  <a class="btn" href={target && started ? target.href : c.entryHref} data-course-continue>
                    {target && started && done < plan.days.length ? `Continue Day ${target.day} →` : started ? 'Open course →' : 'Start course →'}
                  </a>
                )}
                <a class="btn btn-ghost" href={c.outlineHref}>
                  Course outline
                </a>
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
