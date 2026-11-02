// T056 — one question at a time with progress, domain chip, prev/next and submit confirmation.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getStore } from '../../lib/progress/store';
import { createQuizSession, isAnswered, type QuizSession } from '../../lib/quiz-state';
import type { Answer, Attempt, Question } from '../../lib/types';
import QuestionMatching from './QuestionMatching';
import QuestionMulti from './QuestionMulti';
import QuestionOrdering from './QuestionOrdering';
import QuestionSingle from './QuestionSingle';
import Results from './Results';

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
    setBest(session.best());
    root.current?.scrollIntoView({ block: 'start' });
  };
  const requestSubmit = () => (remaining > 0 ? setConfirming(true) : submit());
  const retake = () => {
    moved.current = true;
    setAttempt(null);
    setAnswers({});
    setIndex(0);
  };

  if (questions.length === 0)
    return <p class="muted">{kind === 'weekly' ? 'The cumulative test for this week is coming soon.' : 'Questions for this day are coming soon.'}</p>;

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
            {q.type === 'single' && <QuestionSingle q={q} value={answers[q.id] as string[]} onChange={setAnswer} />}
            {q.type === 'multi' && <QuestionMulti q={q} value={answers[q.id] as string[]} onChange={setAnswer} />}
            {q.type === 'ordering' && <QuestionOrdering q={q} value={answers[q.id] as string[]} onChange={setAnswer} />}
            {q.type === 'matching' && <QuestionMatching q={q} value={answers[q.id] as Record<string, string>} onChange={setAnswer} />}
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
