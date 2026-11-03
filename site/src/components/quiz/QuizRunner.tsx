// T056 — one question at a time with progress, domain chip, ‹ › edge arrows and a final submit on the
// last question. Answers, submitted (locked) questions and the current question are saved in the
// learner's in-progress attempt, so a reload or another device reopens the quiz where it was left.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getStore } from '../../lib/progress/store';
import { canSubmitAnswer, createQuizSession, displayOrder, isAnswered, type QuizSession } from '../../lib/quiz-state';
import type { Answer, Attempt, Question } from '../../lib/types';
import QuestionMatching from './QuestionMatching';
import QuestionMulti from './QuestionMulti';
import QuestionOrdering from './QuestionOrdering';
import QuestionSingle from './QuestionSingle';
import AttemptHistory from './AttemptHistory';
import Results, { QuestionFeedback } from './Results';

interface Props {
  assessmentId: string;
  title: string;
  questions: Question[];
  /** 'weekly' on review days (`week-N`); defaults to the daily quiz. */
  kind?: Attempt['kind'];
}

// In slide view the quiz slide hides the deck's ‹ › (one set of arrows): past the first/last question
// the quiz arrows hand over to the deck (previous / next slide). In full-page view they stop at the ends.
const inDeck = () => typeof document !== 'undefined' && document.documentElement.dataset.lessonView === 'slides' && !!document.querySelector('.slide-deck .quiz-slot, .slide-deck [data-section-type="quiz"]');
const deckNav = (dir: 'prev' | 'next') => document.dispatchEvent(new CustomEvent('deck-nav', { detail: dir }));

export default function QuizRunner({ assessmentId, title, questions, kind = 'daily' }: Props) {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [best, setBest] = useState<number | undefined>(undefined);
  // Questions whose answer was submitted (locked, feedback shown) — saved with the in-progress attempt.
  const [checked, setChecked] = useState<string[]>([]);
  const [attempts, setAttempts] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  // Slide view is set up after the quiz may already have rendered (fonts/images first), and the learner
  // can switch views: follow the <html data-lesson-view> attribute.
  const [deck, setDeck] = useState(false);
  useEffect(() => {
    const update = () => setDeck(inDeck());
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-lesson-view', 'data-deck-ready'] });
    return () => mo.disconnect();
  }, []);
  const moved = useRef(false);

  useEffect(() => {
    const s = createQuizSession(getStore(), assessmentId, questions, kind);
    setSession(s);
    setAnswers(s.answers());
    setChecked(s.checked());
    setIndex(s.index());
    setBest(s.best());
    setAttempts(s.attemptCount());
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
    const next = Math.max(0, Math.min(questions.length - 1, i));
    setIndex(next);
    session?.setIndex(next);
  };
  const submit = () => {
    if (!session) return;
    const a = session.submit();
    moved.current = true;
    setConfirming(false);
    setAttempt(a);
    setChecked([]);
    setIndex(0);
    setBest(session.best());
    setAttempts(session.attemptCount());
    root.current?.scrollIntoView({ block: 'start' });
  };
  const requestSubmit = () => (remaining > 0 ? setConfirming(true) : submit());
  const isChecked = checked.includes(q.id);
  const ready = canSubmitAnswer(q, answers[q.id]);
  const checkAnswer = () => {
    if (!ready || isChecked) return;
    // An untouched ordering question is answered with the order shown.
    session?.check(q.id, q.type === 'ordering' && !answers[q.id] ? displayOrder(q) : undefined);
    if (session) {
      setAnswers(session.answers());
      setChecked(session.checked());
    }
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
        <>
          <Results questions={questions} attempt={attempt} best={best} onRetake={retake} />
          {/* Results already has its own Retake button, so the history below it doesn't repeat one. */}
          <AttemptHistory assessmentId={assessmentId} questions={questions} kind={kind} refreshKey={attempts} />
        </>
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
          {attempts > 0 && index === 0 && answeredCount === 0 && checked.length === 0 && (
            <AttemptHistory assessmentId={assessmentId} questions={questions} kind={kind} refreshKey={attempts} />
          )}

          <div class="card mt-4 quiz-card" key={q.id}>
            <button type="button" class="quiz-arrow quiz-arrow-prev" aria-label="Previous question" title="Previous question" disabled={index === 0 && !deck} onClick={() => (index === 0 ? deckNav('prev') : go(index - 1))}>
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" class="quiz-arrow quiz-arrow-next" aria-label="Next question" title="Next question" disabled={index === questions.length - 1 && !deck} onClick={() => (index === questions.length - 1 ? deckNav('next') : go(index + 1))}>
              <span aria-hidden="true">›</span>
            </button>
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
                  <button type="button" class="btn" data-submit-quiz onClick={requestSubmit}>
                    Submit quiz →
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
                  {index === questions.length - 1 && (
                    // Last question only: hand in the whole quiz (unanswered ones are confirmed first).
                    <button type="button" class="btn btn-ghost q-submit-quiz" data-submit-quiz onClick={requestSubmit}>
                      Submit quiz
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <p class="quiz-count muted text-sm" aria-live="polite">
            {answeredCount} / {questions.length} answered
          </p>

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
