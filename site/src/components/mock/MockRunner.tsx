// T091 — full mock exam: intro → timed exam (palette, flags) → review screen → scaled results with domain breakdown.
// The deadline lives in progress.inProgress, so a reload resumes the clock and an expired deadline auto-submits.
import { useEffect, useRef, useState } from 'preact/hooks';
import {
  createMockSession,
  MOCK_MINUTES,
  PASS_SCALED,
  READY_PERCENT,
  type MockSession,
} from '../../lib/mock';
import { getStore } from '../../lib/progress/store';
import { isAnswered } from '../../lib/quiz-state';
import { domainRows } from '../../lib/review';
import type { Answer, Attempt, Question } from '../../lib/types';
import QuestionMatching from '../quiz/QuestionMatching';
import QuestionMulti from '../quiz/QuestionMulti';
import QuestionOrdering from '../quiz/QuestionOrdering';
import QuestionSingle from '../quiz/QuestionSingle';
import { AnswerReview } from '../quiz/Results';
import { DomainBreakdown } from '../review/DomainResults';
import Palette from './Palette';
import ReviewScreen from './ReviewScreen';
import Timer from './Timer';

interface Props {
  assessmentId: string;
  n: number;
  questions: Question[];
  domainNames: Record<string, string>;
  dayTitles: Record<string, string>;
  minutes?: number;
}

type Phase = 'loading' | 'intro' | 'exam' | 'review' | 'results';

export default function MockRunner({
  assessmentId,
  n,
  questions,
  domainNames,
  dayTitles,
  minutes = MOCK_MINUTES,
}: Props) {
  const [session, setSession] = useState<MockSession | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [flagged, setFlagged] = useState<string[]>([]);
  const [deadline, setDeadline] = useState<string | undefined>(undefined);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [last, setLast] = useState<Attempt | undefined>(undefined);
  const root = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const sync = (s: MockSession) => {
    setAnswers(s.answers());
    setFlagged(s.flagged());
    setDeadline(s.deadline());
  };

  useEffect(() => {
    const s = createMockSession(getStore(), assessmentId, questions, { minutes });
    setSession(s);
    setLast(s.lastAttempt());
    const status = s.status();
    if (status === 'expired') {
      setAttempt(s.submit(true));
      setPhase('results');
    } else {
      sync(s);
      setPhase(status === 'running' ? 'exam' : 'intro');
    }
  }, [assessmentId, questions, minutes]);

  useEffect(() => {
    if (!moved.current) return;
    const target = phase === 'exam' ? '.q-stem' : phase === 'results' ? '[data-results-heading]' : null;
    if (target) root.current?.querySelector<HTMLElement>(target)?.focus();
  }, [index, phase]);

  const q = questions[index];
  const answeredCount = questions.filter((x) => isAnswered(x, answers[x.id])).length;

  const start = () => {
    if (!session) return;
    session.start();
    sync(session);
    moved.current = true;
    setIndex(0);
    setAttempt(null);
    setPhase('exam');
  };
  const go = (i: number) => {
    moved.current = true;
    setIndex(Math.max(0, Math.min(questions.length - 1, i)));
    setPhase('exam');
  };
  const setAnswer = (v: Answer) => {
    session?.answer(q.id, v);
    if (session) sync(session);
  };
  const toggleFlag = () => {
    session?.toggleFlag(q.id);
    if (session) sync(session);
  };
  const submit = (auto = false) => {
    if (!session || phase === 'results') return;
    const a = session.submit(auto);
    moved.current = true;
    setAttempt(a);
    setLast(a);
    setDeadline(undefined);
    setPhase('results');
    root.current?.scrollIntoView({ block: 'start' });
  };

  if (questions.length === 0) return <p class="muted">This mock exam is coming soon.</p>;

  const header = (
    <div class="mock-head">
      <div>
        <p class="muted text-sm m-0">
          Mock exam {n} · {questions.length} questions · {minutes} minutes
        </p>
        <p class="h1 m-0" aria-live="polite">
          {phase === 'review' ? 'Review' : `Question ${index + 1} of ${questions.length}`}
        </p>
      </div>
      {deadline && <Timer deadline={deadline} onExpire={() => submit(true)} />}
    </div>
  );

  return (
    <div
      class="mock-runner"
      ref={root}
      data-ready={phase === 'loading' ? undefined : 'true'}
      data-phase={phase}
      data-mock={assessmentId}
    >
      {phase === 'loading' && <p class="muted">Loading the exam…</p>}

      {phase === 'intro' && (
        <div class="card mock-intro">
          <h2 class="h2 m-0">Before you start</h2>
          <ul class="mt-3">
            <li>
              {questions.length} questions, {minutes} minutes — the same format as the real AIF-C01 exam.
            </li>
            <li>
              Flag questions you want to revisit; the review screen lists flagged and unanswered questions
              before you submit.
            </li>
            <li>
              The clock keeps running if you leave or reload the page. At 00:00 the exam is submitted
              automatically.
            </li>
            <li>
              Unanswered questions count as incorrect. Pass mark: {PASS_SCALED} on a 100–1000 scale. Aim for{' '}
              {READY_PERCENT}%+ before booking the real exam.
            </li>
          </ul>
          {last && (
            <p class="m-0 mt-2 text-sm" data-last-attempt>
              Last attempt: <strong>{last.score.scaled}</strong> / 1000 ·{' '}
              {(last.score.scaled ?? 0) >= PASS_SCALED ? 'PASS' : 'FAIL'} ·{' '}
              {new Date(last.submittedAt).toLocaleDateString()}
            </p>
          )}
          <button type="button" class="btn mt-4" onClick={start}>
            {last ? 'Start a new attempt' : 'Start mock exam'} →
          </button>
        </div>
      )}

      {phase === 'exam' && (
        <>
          {header}
          <div class="mock-grid">
            <div class="card quiz-card" key={q.id}>
              <span class={`chip chip-${q.domain}`}>
                {q.domain} · {q.taskStatement}
              </span>
              <div class="mt-2">
                {q.type === 'single' && (
                  <QuestionSingle q={q} value={answers[q.id] as string[]} onChange={setAnswer} />
                )}
                {q.type === 'multi' && (
                  <QuestionMulti q={q} value={answers[q.id] as string[]} onChange={setAnswer} />
                )}
                {q.type === 'ordering' && (
                  <QuestionOrdering q={q} value={answers[q.id] as string[]} onChange={setAnswer} />
                )}
                {q.type === 'matching' && (
                  <QuestionMatching
                    q={q}
                    value={answers[q.id] as Record<string, string>}
                    onChange={setAnswer}
                  />
                )}
              </div>
              <div class="mock-actions">
                <button
                  type="button"
                  class="btn btn-ghost"
                  onClick={() => go(index - 1)}
                  disabled={index === 0}
                >
                  ← Previous
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-flag"
                  aria-pressed={flagged.includes(q.id) ? 'true' : 'false'}
                  aria-label={`Flag question ${index + 1} for review`}
                  onClick={toggleFlag}
                >
                  ⚑ {flagged.includes(q.id) ? 'Flagged' : 'Flag'}
                </button>
                {index < questions.length - 1 ? (
                  <button type="button" class="btn" onClick={() => go(index + 1)}>
                    Next →
                  </button>
                ) : (
                  <button type="button" class="btn" onClick={() => setPhase('review')}>
                    Review &amp; submit
                  </button>
                )}
              </div>
            </div>
            <div class="card mock-side">
              <h2 class="font-semibold m-0 mb-2 text-base">
                Questions <span class="muted text-sm font-normal">· {answeredCount} answered</span>
              </h2>
              <Palette
                questions={questions}
                answers={answers}
                flagged={flagged}
                current={index}
                onJump={go}
              />
              <button type="button" class="btn mt-4 w-full justify-center" onClick={() => setPhase('review')}>
                Review &amp; submit
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'review' && (
        <>
          {header}
          <div class="mt-4">
            <ReviewScreen
              questions={questions}
              answers={answers}
              flagged={flagged}
              onJump={go}
              onBack={() => go(index)}
              onSubmit={() => submit(false)}
            />
          </div>
        </>
      )}

      {phase === 'results' && attempt && (
        <MockResults
          attempt={attempt}
          questions={questions}
          domainNames={domainNames}
          dayTitles={dayTitles}
          onRestart={start}
        />
      )}
    </div>
  );
}

function MockResults({
  attempt,
  questions,
  domainNames,
  dayTitles,
  onRestart,
}: {
  attempt: Attempt;
  questions: Question[];
  domainNames: Record<string, string>;
  dayTitles: Record<string, string>;
  onRestart: () => void;
}) {
  const scaled = attempt.score.scaled ?? 100;
  const pass = scaled >= PASS_SCALED;
  const ready = attempt.score.percent >= READY_PERCENT;
  return (
    <div class="mock-results" data-pass={pass ? 'true' : 'false'}>
      {attempt.autoSubmitted && (
        <div class="card notice-auto" role="status" data-auto-submitted>
          ⏱ Time ran out — your exam was submitted automatically. Unanswered questions count as incorrect.
        </div>
      )}
      <div class="card scaled-card mt-4">
        <div>
          <p class="muted text-sm m-0">Scaled score</p>
          <h2 class="scaled-num m-0" tabIndex={-1} data-results-heading>
            {scaled}
            <span class="muted text-base font-normal"> / 1000</span>
          </h2>
        </div>
        <div>
          <span class={`pill ${pass ? 'pill-pass' : 'pill-fail'}`} data-verdict>
            {pass ? 'PASS' : 'FAIL'}
          </span>
          <p class="m-0 mt-2 text-sm">
            Pass mark {PASS_SCALED} · {attempt.score.correct} / {attempt.score.total} correct (
            {Math.round(attempt.score.percent)}%)
          </p>
          <p class="m-0 mt-1 text-sm" data-readiness={ready ? 'ready' : 'not-ready'}>
            {ready
              ? `Exam-ready: you scored ${READY_PERCENT}%+ — book the exam while it is fresh.`
              : `Aim for ${READY_PERCENT}%+ (${Math.ceil((READY_PERCENT / 100) * attempt.score.total)} of ${attempt.score.total}) before booking the real exam.`}
          </p>
        </div>
      </div>
      <h3 class="h2 mt-8">Results by domain</h3>
      <div class="card">
        <DomainBreakdown
          rows={domainRows(attempt, questions)}
          domainNames={domainNames}
          dayTitles={dayTitles}
        />
      </div>
      <details class="mt-6 mock-answers">
        <summary class="h2">Review every answer ({questions.length})</summary>
        <AnswerReview questions={questions} answers={attempt.answers} />
      </details>
      <button type="button" class="btn mt-6" onClick={onRestart}>
        ↻ Start a new attempt
      </button>
    </div>
  );
}
