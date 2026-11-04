// Attempt history for a daily quiz, weekly test or mock exam: every submitted attempt numbered #1, #2, …,
// with date, score, pass/fail (mocks) and the best marked; "Review" re-opens that attempt read-only.
import { useEffect, useState } from 'preact/hooks';
import { attemptsFor, formatDuration, formatWhen, type History } from '../../lib/attempt-history';
import { getStore } from '../../lib/progress/store';
import type { Attempt, Question } from '../../lib/types';
import { AnswerReview } from './Results';
import '../../styles/attempt-history.css';

interface Props {
  assessmentId: string;
  questions: Question[];
  kind: Attempt['kind'];
  onRetake?: () => void;
  /** Bump to re-read the store (e.g. right after an attempt is submitted). */
  refreshKey?: number;
  /** Where "Retake" goes when there is no onRetake callback (e.g. from an Astro page). */
  retakeHref?: string;
  /** Course the questions belong to (lesson links in the review). */
  courseId?: string;
}

const noun = (kind: Attempt['kind']) => (kind === 'mock' ? 'exam' : kind === 'weekly' ? 'test' : 'quiz');

export default function AttemptHistory({ assessmentId, questions, kind, onRetake, refreshKey = 0, retakeHref, courseId }: Props) {
  const [history, setHistory] = useState<History | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const store = getStore();
    const read = () => {
      const state = store.get();
      setHistory(attemptsFor(state, assessmentId));
      setRunning(Boolean(state.inProgress[assessmentId]));
    };
    read();
    return store.subscribe(read);
  }, [assessmentId, refreshKey]);

  // Hidden while a mock exam is being taken: reviewing earlier attempts would show the answers.
  if (!history || history.rows.length === 0 || (kind === 'mock' && running)) return null;
  const { rows, best } = history;
  const shown = open === null ? null : rows.find((r) => r.number === open) ?? null;
  const what = noun(kind);

  return (
    <section class="attempt-history card" data-attempt-history={assessmentId} aria-labelledby={`${assessmentId}-history-h`}>
      <details open>
        <summary>
          <h3 class="h2 m-0 inline" id={`${assessmentId}-history-h`}>
            Your attempts ({rows.length})
          </h3>
          {best && (
            <span class="muted text-sm">
              {' '}
              · best {kind === 'mock' ? `${best.scaled} / 1000` : `${best.percent}%`} (attempt #{best.number})
            </span>
          )}
        </summary>
        <div class="ah-table-wrap">
          <table class="ah-table">
            <caption class="sr-only">Every attempt of this {what}, oldest first</caption>
            <thead>
              <tr>
                <th scope="col">Attempt</th>
                <th scope="col">Date</th>
                <th scope="col">Score</th>
                <th scope="col">Time</th>
                <th scope="col">
                  <span class="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {[...rows].reverse().map((r) => (
                <tr key={r.number} data-attempt-row={r.number} data-open={open === r.number ? 'true' : undefined}>
                  <th scope="row">
                    #{r.number}
                    {r.isBest && <span class="ah-badge ah-best">Best</span>}
                    {r.isLatest && rows.length > 1 && <span class="ah-badge">Latest</span>}
                  </th>
                  <td>{formatWhen(r.attempt.submittedAt)}</td>
                  <td>
                    <span data-attempt-score>
                      {r.correct} / {r.total} ({r.percent}%)
                    </span>
                    {r.scaled !== undefined && (
                      <>
                        {' '}
                        · {r.scaled} / 1000{' '}
                        <span class={`ah-badge ${r.passed ? 'ah-pass' : 'ah-fail'}`}>{r.passed ? 'Pass' : 'Below 700'}</span>
                      </>
                    )}
                    {r.attempt.autoSubmitted && <span class="ah-badge">Time ran out</span>}
                  </td>
                  <td>{formatDuration(r.durationMs)}</td>
                  <td>
                    <button
                      type="button"
                      class="btn ah-review"
                      aria-expanded={open === r.number ? 'true' : 'false'}
                      aria-controls={`${assessmentId}-review`}
                      onClick={() => setOpen(open === r.number ? null : r.number)}
                    >
                      {open === r.number ? 'Hide review' : 'Review'}
                      <span class="sr-only"> attempt #{r.number}</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(onRetake || retakeHref) &&
          (onRetake ? (
            <button type="button" class="btn mt-3" onClick={onRetake} data-retake>
              ↻ Retake {what}
            </button>
          ) : (
            <a class="btn mt-3" href={retakeHref} data-retake>
              ↻ Retake {what}
            </a>
          ))}
        <div id={`${assessmentId}-review`} class="ah-review-panel" hidden={!shown}>
          {shown && (
            <>
              <h4 class="h2 mt-6" data-review-heading>
                Attempt #{shown.number} · {shown.correct} / {shown.total} ({shown.percent}%) · {formatWhen(shown.attempt.submittedAt)}
              </h4>
              <AnswerReview questions={questions} answers={shown.attempt.answers} courseId={courseId} />
            </>
          )}
        </div>
      </details>
    </section>
  );
}
