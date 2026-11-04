// T056 — one question at a time with progress, domain chip and ‹ › edge arrows. No per-question submit
// (learner feedback 2026-11-03): selecting options answers a question; the only submit is "Submit quiz"
// on the last question, enabled once every question meets its requirement. Answers and the current
// question are saved in the learner's in-progress attempt, so a reload or another device reopens it.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { getStore } from '../../lib/progress/store';
import { createQuizSession, incomplete, isAnswered, type QuizSession } from '../../lib/quiz-state';
import type { Answer, Attempt, Question } from '../../lib/types';
import QuestionMatching from './QuestionMatching';
import QuestionMulti from './QuestionMulti';
import QuestionOrdering from './QuestionOrdering';
import QuestionSingle from './QuestionSingle';
import AttemptHistory from './AttemptHistory';
import NextSteps, { type NextStepsContext } from './NextSteps';
import Results from './Results';

interface Props {
  assessmentId: string;
  title: string;
  questions: Question[];
  /** 'weekly' on review days (`week-N`); defaults to the daily quiz. */
  kind?: Attempt['kind'];
  /** Day / next day / badge data for the "What's next" panel on the results (omitted → no panel). */
  next?: NextStepsContext;
}

// In slide view the quiz slide hides the deck's ‹ › (one set of arrows): past the first/last question
// the quiz arrows hand over to the deck (previous / next slide). In full-page view they stop at the ends.
const inDeck = () => typeof document !== 'undefined' && document.documentElement.dataset.lessonView === 'slides' && !!document.querySelector('.slide-deck .quiz-slot, .slide-deck [data-section-type="quiz"]');
const deckNav = (dir: 'prev' | 'next') => document.dispatchEvent(new CustomEvent('deck-nav', { detail: dir }));

export default function QuizRunner({ assessmentId, title, questions, kind = 'daily', next }: Props) {
  const [session, setSession] = useState<QuizSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [best, setBest] = useState<number | undefined>(undefined);
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
    setIndex(s.index());
    setBest(s.best());
    setAttempts(s.attemptCount());
  }, [assessmentId, questions, kind]);

  // Move focus to the new question / results for keyboard and screen-reader users (not on first render).
  useEffect(() => {
    if (!moved.current) return;
    root.current?.querySelector<HTMLElement>(attempt ? '[data-next-heading], [data-results-heading]' : '.q-stem')?.focus();
  }, [index, attempt]);

  const q = questions[index];
  const answeredCount = useMemo(() => questions.filter((x) => isAnswered(x, answers[x.id])).length, [questions, answers]);
  const pending = useMemo(() => incomplete(questions, answers), [questions, answers]);
  const last = index === questions.length - 1;

  const setAnswer = (v: Answer) => {
    session?.answer(q.id, v);
    setAnswers(session ? session.answers() : { ...answers, [q.id]: v });
  };
  const go = (i: number) => {
    moved.current = true;
    const next = Math.max(0, Math.min(questions.length - 1, i));
    setIndex(next);
    session?.setIndex(next);
  };
  const submit = () => {
    if (!session || pending.length) return;
    const a = session.submit();
    moved.current = true;
    setAttempt(a);
    setIndex(0);
    setBest(session.best());
    setAttempts(session.attemptCount());
    // The "What's next" panel is at the top of the results: bring it into view (in slide view the quiz
    // slide's card scrolls, so reset it too).
    requestAnimationFrame(() => {
      const card = root.current?.closest<HTMLElement>('.slide-deck article');
      if (card) card.scrollTop = 0;
      root.current?.scrollIntoView({ block: 'nearest' });
    });
  };
  const review = () => {
    const h = root.current?.querySelector<HTMLElement>('[data-review-heading]');
    h?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    h?.focus({ preventScroll: true });
  };
  const retake = () => {
    moved.current = true;
    setAttempt(null);
    setAnswers({});
    setIndex(0);
  };

  if (questions.length === 0)
    return <p class="muted">{kind === 'weekly' ? 'The cumulative test for this module is coming soon.' : 'Questions for this day are coming soon.'}</p>;

  return (
    <div class="quiz" ref={root} data-ready={session ? 'true' : undefined} data-quiz={assessmentId}>
      {attempt ? (
        <>
          {next && <NextSteps kind={kind} attempt={attempt} questions={questions} {...next} onRetake={retake} onReview={review} />}
          <Results questions={questions} attempt={attempt} best={best} onRetake={retake} hideRetake={!!next} />
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
            {/* One compact row: question number, domain chip, progress (short screens / 150 % scaling). */}
            <div class="quiz-q-row">
              <p class="h2 m-0 quiz-qno" aria-live="polite">
                Question {index + 1} of {questions.length}
              </p>
              <span class={`chip chip-${q.domain}`}>
                {q.domain} · {q.taskStatement}
              </span>
              <progress class="quiz-progress" max={questions.length} value={answeredCount} aria-label={`${answeredCount} of ${questions.length} answered`} />
            </div>
          </div>
          {attempts > 0 && index === 0 && answeredCount === 0 && (
            <AttemptHistory assessmentId={assessmentId} questions={questions} kind={kind} refreshKey={attempts} />
          )}

          <div class="card quiz-card" key={q.id}>
            <button type="button" class="quiz-arrow quiz-arrow-prev" aria-label="Previous question" title="Previous question" disabled={index === 0 && !deck} onClick={() => (index === 0 ? deckNav('prev') : go(index - 1))}>
              <span aria-hidden="true">‹</span>
            </button>
            <button type="button" class="quiz-arrow quiz-arrow-next" aria-label="Next question" title="Next question" disabled={index === questions.length - 1 && !deck} onClick={() => (index === questions.length - 1 ? deckNav('next') : go(index + 1))}>
              <span aria-hidden="true">›</span>
            </button>
            {q.type === 'single' && <QuestionSingle q={q} value={answers[q.id] as string[]} onChange={setAnswer} />}
            {q.type === 'multi' && <QuestionMulti q={q} value={answers[q.id] as string[]} onChange={setAnswer} />}
            {q.type === 'ordering' && <QuestionOrdering q={q} value={answers[q.id] as string[]} onChange={setAnswer} />}
            {q.type === 'matching' && <QuestionMatching q={q} value={answers[q.id] as Record<string, string>} onChange={setAnswer} />}
            {last && (
              // The only submit: on the last question, once every question meets its requirement.
              <div class="q-submit-row">
                <button type="button" class="btn" data-submit-quiz disabled={pending.length > 0} aria-describedby={pending.length ? 'quiz-pending' : undefined} onClick={submit}>
                  Submit quiz
                </button>
                {pending.length > 0 && (
                  <>
                    <span class="muted text-sm" id="quiz-pending" data-pending={pending.length}>
                      {pending.length} {pending.length === 1 ? 'question' : 'questions'} unanswered
                    </span>
                    <button type="button" class="btn btn-ghost" data-first-unanswered onClick={() => go(questions.indexOf(pending[0]))}>
                      Go to first unanswered
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <p class="quiz-count muted text-sm" aria-live="polite">
            {answeredCount} / {questions.length} answered
          </p>

        </>
      )}
    </div>
  );
}
