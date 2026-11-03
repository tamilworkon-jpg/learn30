// T056 — one question at a time with progress, domain chip, prev/next and submit confirmation.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getStore } from '../../lib/progress/store';
import { canSubmitAnswer, createQuizSession, displayOrder, isAnswered, type QuizSession } from '../../lib/quiz-state';
import type { Answer, Attempt, Question } from '../../lib/types';
import QuestionMatching from './QuestionMatching';
import QuestionMulti from './QuestionMulti';
import QuestionOrdering from './QuestionOrdering';
import QuestionSingle from './QuestionSingle';
import Results, { QuestionFeedback } from './Results';

interface Props {
  assessmentId: string;
  title: string;
  questions: Question[];
  /** 'weekly' on review days (`week-N`); defaults to the daily quiz. */
  kind?: Attempt['kind'];
}

export default function QuizRunner({ assessmentId, title, questions, kind = 'daily' }: Props) {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [best, setBest] = useState<number | undefined>(undefined);
  // Questions whose answer was submitted in this sitting (locked, feedback shown). Not persisted: after a
  // reload the saved answers stay and can be submitted again.
  const [checked, setChecked] = useState<string[]>([]);
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    const s = createQuizSession(getStore(), assessmentId, questions, kind);
    setSession(s);
    setAnswers(s.answers());
    setBest(s.best());
  }, [assessmentId, questions, kind]);

  // Move focus to the new question / results for keyboard and screen-reader users (not on first render).
  useEffect(() => {
    if (!moved.current) return;
    root.current?.querySelector<HTMLElement>(attempt ? '[data-results-heading]' : '.q-stem')?.focus();
  }, [index, attempt]);

  const q = questions[index];
  const answeredCount = useMemo(() => questions.filter((x) => isAnswered(x, answers[x.id])).length, [questions, answers]);
  const remaining = questions.length - answeredCount;

  const setAnswer = (v: Answer) => {
    session?.answer(q.id, v);
    setAnswers(session ? session.answers() : { ...answers, [q.id]: v });
  };
  const go = (i: number) => {
    moved.current = true;
    setConfirming(false);
    setIndex(Math.max(0, Math.min(questions.length - 1, i)));
  };
  const submit = () => {
    if (!session) return;
    const a = session.submit();
    moved.current = true;
    setConfirming(false);
    setAttempt(a);
    setChecked([]);
    setBest(session.best());
    root.current?.scrollIntoView({ block: 'start' });
  };
  const requestSubmit = () => (remaining > 0 ? setConfirming(true) : submit());
  const isChecked = checked.includes(q.id);
  const ready = canSubmitAnswer(q, answers[q.id]);
  const checkAnswer = () => {
    if (!ready || isChecked) return;
    // An untouched ordering question is answered with the order shown.
    if (q.type === 'ordering' && !answers[q.id]) setAnswer(displayOrder(q));
    setChecked([...checked, q.id]);
  };
  const retake = () => {
    moved.current = true;
    setAttempt(null);
    setAnswers({});
    setChecked([]);
    setIndex(0);
  };

  if (questions.length === 0)
    return <p class="muted">{kind === 'weekly' ? 'The cumulative test for this module is coming soon.' : 'Questions for this day are coming soon.'}</p>;

  return (
    <div class="quiz" ref={root} data-ready={session ? 'true' : undefined} data-quiz={assessmentId}>
      {attempt ? (
        <Results questions={questions} attempt={attempt} best={best} onRetake={retake} />
      ) : (
        <>
          <div class="quiz-head">
            <p class="muted text-sm m-0">
              {title}
              {best !== undefined && <span class="pill pill-soft quiz-best">Best score: {best}%</span>}
            </p>
            <div class="flex flex-wrap items-center gap-3 mt-2">
              <p class="h2 m-0" aria-live="polite">
                Question {index + 1} of {questions.length}
              </p>
              <span class={`chip chip-${q.domain}`}>
                {q.domain} · {q.taskStatement}
              </span>
            </div>
            <progress class="quiz-progress mt-3" max={questions.length} value={answeredCount} aria-label={`${answeredCount} of ${questions.length} answered`} />
          </div>

          <div class="card mt-4 quiz-card" key={q.id}>
            {q.type === 'single' && <QuestionSingle q={q} value={answers[q.id] as string[]} onChange={setAnswer} locked={isChecked} reveal={isChecked} />}
            {q.type === 'multi' && <QuestionMulti q={q} value={answers[q.id] as string[]} onChange={setAnswer} locked={isChecked} reveal={isChecked} />}
            {q.type === 'ordering' && <QuestionOrdering q={q} value={answers[q.id] as string[]} onChange={setAnswer} locked={isChecked} />}
            {q.type === 'matching' && <QuestionMatching q={q} value={answers[q.id] as Record<string, string>} onChange={setAnswer} locked={isChecked} />}
            {isChecked && <QuestionFeedback q={q} answer={answers[q.id]} />}
            <div class="q-submit-row">
              {isChecked ? (
                index < questions.length - 1 ? (
                  <button type="button" class="btn" data-next-question onClick={() => go(index + 1)}>
                    Next question →
                  </button>
                ) : (
                  <button type="button" class="btn" data-next-question onClick={requestSubmit}>
                    See my results →
                  </button>
                )
              ) : (
                <>
                  <button type="button" class="btn" data-submit-answer disabled={!ready} aria-describedby={ready ? undefined : `${q.id}-gate`} onClick={checkAnswer}>
                    Submit answer
                  </button>
                  {!ready && (
                    <span class="muted text-sm" id={`${q.id}-gate`}>
                      {q.type === 'multi' ? `Choose ${(q.answer as string[]).length} answers to submit` : q.type === 'matching' ? 'Match every item to submit' : 'Choose an answer to submit'}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <div class="quiz-nav">
            <button type="button" class="btn btn-ghost" onClick={() => go(index - 1)} disabled={index === 0}>
              ← Previous
            </button>
            <span class="muted text-sm">
              {answeredCount} / {questions.length} answered
            </span>
            {index < questions.length - 1 ? (
              <button type="button" class="btn" onClick={() => go(index + 1)}>
                Next →
              </button>
            ) : (
              <button type="button" class="btn" onClick={requestSubmit}>
                Submit quiz
              </button>
            )}
          </div>
          {index < questions.length - 1 && (
            <p class="text-right m-0 mt-2">
              <button type="button" class="link-btn text-sm" onClick={requestSubmit}>
                Submit now
              </button>
            </p>
          )}

          {confirming && (
            <div class="card quiz-confirm" role="alertdialog" aria-labelledby="quiz-confirm-title" aria-describedby="quiz-confirm-desc">
              <p class="m-0 font-semibold" id="quiz-confirm-title">
                Submit with {remaining} unanswered {remaining === 1 ? 'question' : 'questions'}?
              </p>
              <p class="m-0 mt-1 text-sm" id="quiz-confirm-desc">
                Unanswered questions count as incorrect.
              </p>
              <div class="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  class="btn btn-ghost"
                  ref={(el) => el?.focus()}
                  onClick={() => {
                    setConfirming(false);
                    const first = questions.findIndex((x) => !isAnswered(x, answers[x.id]));
                    go(first < 0 ? index : first);
                  }}
                >
                  Go to first unanswered
                </button>
                <button type="button" class="btn" onClick={submit}>
                  Submit anyway
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
