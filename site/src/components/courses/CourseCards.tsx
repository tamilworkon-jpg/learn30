// Learn30 catalogue: one card per course (src/data/courses.yaml). Signed in, each card shows THAT course's
// progress from the per-course summary in the page bootstrap (spec 002); a server that predates per-course
// progress has no summary, so the first course falls back to the progress store. Signed out: sign-in prompt.
import { useEffect, useState } from 'preact/hooks';
import { isSignedIn } from '../../lib/bootstrap';
import type { CoursePlan } from '../../lib/course-plan';
import { nextDayOf, readSummary, type CourseSummary, type Summary } from '../../lib/course-summary';
import type { CourseCard } from '../../lib/courses';
import { completedCount } from '../../lib/dashboard';
import { getStore } from '../../lib/progress/store';
import { courseHref, DEFAULT_COURSE_ID } from '../../lib/routes';
import { formatDate, projectedFinish } from '../../lib/schedule';
import '../../styles/courses.css';

interface Props {
  courses: CourseCard[];
  /** Plans of available courses (for the store fallback). */
  plans: Record<string, CoursePlan>;
}

export default function CourseCards({ courses, plans }: Props) {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<Summary>({});

  useEffect(() => {
    const inn = isSignedIn();
    setSignedIn(inn);
    if (!inn) return;
    const s = readSummary();
    // The page's own course store (the first course on global pages) is live: progress imported or saved
    // on this page (e.g. the legacy-import offer) must show without a reload.
    const plan = plans[DEFAULT_COURSE_ID];
    const store = plan ? getStore(DEFAULT_COURSE_ID) : null;
    const live = (): Summary => {
      if (!store || !plan) return {};
      const p = store.get();
      const started = Object.keys(p.days).length > 0 || p.attempts.length > 0 || !!p.lastPosition;
      return started ? { [DEFAULT_COURSE_ID]: { completed: completedCount(p, plan), startedAt: p.startedAt, lastPosition: p.lastPosition } } : {};
    };
    const merge = () => setSummary({ ...(s ?? {}), ...live() });
    merge();
    return store?.subscribe(merge);
  }, []);

  return (
    <ul class="course-grid" role="list" data-courses data-ready={signedIn === null ? undefined : 'true'}>
      {courses.map((c) => {
        const s: CourseSummary | undefined = signedIn ? summary[c.id] : undefined;
        const done = s?.completed ?? 0;
        const pct = Math.round((100 * done) / c.lengthDays);
        // A progress record alone (created on first visit) is not a start: a day done or a lesson opened is.
        const started = !!s && (done > 0 || !!s.lastPosition);
        const finished = done >= c.lengthDays;
        const next = s ? nextDayOf(s, c.lengthDays) : 1;
        const finish = s && !finished ? projectedFinish(new Date(s.startedAt), new Date(), done, c.lengthDays) : null;
        const dashboard = courseHref(c.id);
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

            {c.status === 'available' && signedIn && (
              <div class="course-progress" data-course-progress>
                <progress class="course-bar" max={100} value={pct} aria-label={`${c.shortTitle} progress: ${pct}%`}></progress>
                <p class="text-sm m-0">
                  <strong>
                    {done} of {c.lengthDays} days
                  </strong>{' '}
                  · {pct}%{started && !finished ? ` · next: Day ${next}` : ''}
                  {finish ? ` · finish ${formatDate(finish)}` : finished ? ' · course complete 🎉' : ''}
                </p>
              </div>
            )}
            {c.status === 'available' && signedIn === false && <p class="text-sm muted m-0">Sign in to track your progress and pick up where you left off.</p>}

            {c.status === 'available' && (
              <p class="course-actions m-0">
                {signedIn === false ? (
                  <a class="btn" href={`/login?next=${encodeURIComponent(dashboard)}`}>
                    Sign in to start →
                  </a>
                ) : (
                  <a class="btn" href={started && !finished ? courseHref(c.id, 'day', next) : dashboard} data-course-continue>
                    {started && !finished ? `Continue Day ${next} →` : started ? 'Open course →' : 'Start course →'}
                  </a>
                )}
                <a class="btn btn-ghost" href={courseHref(c.id, 'outline')}>
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
