// "What's next" at the top of the quiz results (learner feedback 2026-11-03: after submitting it was not
// clear what to click). Pass → mark the day complete and start the next one; below the pass mark → the
// lesson sections behind the wrong answers, then retake (or continue anyway).
import { courseHref, DEFAULT_COURSE_ID } from '../../lib/routes';
import { useState } from 'preact/hooks';
import type { BadgeWeek } from '../../lib/badges';
import { completeDay, isDayComplete } from '../../lib/day-complete';
import { passed, PASS_MARK, revisitLinks } from '../../lib/next-steps';
import type { Attempt, Question } from '../../lib/types';

export interface NextStepsContext {
  /** The course (links); defaults to the first course for old callers. */
  courseId?: string;
  /** The course day this quiz belongs to (lesson day, or the review day for a cumulative test). */
  day: number;
  /** The following course day, or null after the last day. */
  nextDay: number | null;
  weeks: BadgeWeek[];
  totalDays: number;
  /** `day-02#explanation` → "Day 2 · The language of machine learning". */
  sectionTitles?: Record<string, string>;
}

interface Props extends NextStepsContext {
  kind: Attempt['kind'];
  attempt: Attempt;
  questions: Question[];
  onRetake: () => void;
  onReview: () => void;
}

export default function NextSteps({ kind, attempt, questions, courseId = DEFAULT_COURSE_ID, day, nextDay, weeks, totalDays, sectionTitles, onRetake, onReview }: Props) {
  const pct = Math.round(attempt.score.percent);
  const ok = passed(pct);
  const [done, setDone] = useState(() => isDayComplete(day));
  const what = kind === 'weekly' ? `Day ${day} cumulative test` : `Day ${day} quiz`;
  const nextHref = nextDay ? courseHref(courseId, 'day', nextDay) : courseHref(courseId);
  const nextLabel = nextDay ? `Day ${nextDay}` : 'your dashboard';
  const revisit = ok ? [] : revisitLinks(questions, attempt.answers, sectionTitles, courseId);

  const goOn = () => {
    if (!isDayComplete(day)) completeDay(day, weeks, totalDays);
    setDone(true);
    window.location.assign(nextHref);
  };
  const primaryContinue = done ? (nextDay ? `Start Day ${nextDay} →` : 'Go to your dashboard →') : nextDay ? `Mark Day ${day} complete & start Day ${nextDay} →` : `Mark Day ${day} complete & finish the course →`;
  const anyway = done ? `Continue to ${nextLabel} anyway` : `Mark complete & continue to ${nextLabel} anyway`;

  return (
    <section class={`card next-steps ${ok ? 'is-pass' : 'is-retry'}`} aria-labelledby="next-steps-h" data-next-steps={ok ? 'pass' : 'retry'}>
      <p class="next-steps-kicker">What's next</p>
      <h3 class="h2 m-0" id="next-steps-h" tabIndex={-1} data-next-heading>
        {ok ? `Nice work — ${what} passed` : `Score ${pct}% — aim for ${PASS_MARK}%`}
      </h3>
      {ok ? (
        <p class="m-0 text-sm muted">
          {pct}% ({attempt.score.correct} / {attempt.score.total}).{' '}
          {nextDay ? `You're ready for Day ${nextDay}.` : 'That was the last day — your dashboard shows the whole course.'}
        </p>
      ) : (
        <>
          <p class="m-0 text-sm">
            {attempt.score.correct} / {attempt.score.total} correct. Revisit these sections, then retake the {kind === 'weekly' ? 'test' : 'quiz'}:
          </p>
          <ul class="next-steps-revisit" data-revisit>
            {revisit.map((r) => (
              <li key={r.ref}>
                <a href={r.href}>{r.title}</a>
                <span class="muted text-sm">
                  {' '}
                  · {r.misses} {r.misses === 1 ? 'question' : 'questions'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      <div class="next-steps-actions">
        {ok ? (
          <>
            <button type="button" class="btn" data-next-primary onClick={goOn}>
              {primaryContinue}
            </button>
            <button type="button" class="btn btn-ghost" onClick={onReview}>
              Review answers
            </button>
            <button type="button" class="btn btn-ghost" onClick={onRetake}>
              ↻ Retake {kind === 'weekly' ? 'test' : 'quiz'}
            </button>
          </>
        ) : (
          <>
            <button type="button" class="btn" data-next-primary onClick={onRetake}>
              ↻ Retake {kind === 'weekly' ? 'test' : 'quiz'}
            </button>
            <button type="button" class="btn btn-ghost" onClick={onReview}>
              Review answers
            </button>
            <button type="button" class="btn btn-ghost" data-next-anyway onClick={goOn}>
              {anyway}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
