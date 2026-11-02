// T057 — results: score ring, per-question review with every option's explanation, lesson links, retake.
import { scoreQuestion } from '../../lib/scoring';
import type { Attempt, Question } from '../../lib/types';

interface Props {
  questions: Question[];
  attempt: Attempt;
  best?: number;
  onRetake: () => void;
}

const R = 50;
const CIRC = 2 * Math.PI * R;

function lessonHref(ref: string) {
  const [day, anchor] = ref.split('#');
  return `/${day.replace('-', '/')}#${anchor}`;
}

function describe(q: Question, a: Attempt['answers'][string] | undefined): string {
  const text = (id: string) => q.options.find((o) => o.id === id)?.text ?? id;
  if (a === undefined) return 'Not answered';
  if (q.type === 'matching') {
    const m = a as Record<string, string>;
    return q.options.map((o) => `${o.text} → ${q.matchTargets?.find((t) => t.id === m[o.id])?.text ?? '—'}`).join('; ');
  }
  const ids = a as string[];
  return q.type === 'ordering' ? ids.map((id, i) => `${i + 1}. ${text(id)}`).join('  ') : ids.map(text).join(', ');
}

export default function Results({ questions, attempt, best, onRetake }: Props) {
  const { correct, total, percent } = attempt.score;
  const pct = Math.round(percent);
  const good = pct >= 80;
  const isBest = best !== undefined && pct >= best;
  return (
    <div class="quiz-results">
      <div class="results-head">
        <svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label={`Score ${pct} percent`}>
          <circle cx="60" cy="60" r={R} fill="none" stroke="var(--border)" stroke-width="12" />
          <circle
            cx="60"
            cy="60"
            r={R}
            fill="none"
            stroke={good ? 'var(--d4)' : 'var(--accent)'}
            stroke-width="12"
            stroke-linecap="round"
            stroke-dasharray={`${(CIRC * pct) / 100} ${CIRC}`}
            transform="rotate(-90 60 60)"
          />
          <text x="60" y="67" text-anchor="middle" font-size="24" font-weight="700" fill="currentColor">
            {pct}%
          </text>
        </svg>
        <div>
          <h3 class="h1 m-0" tabIndex={-1} data-results-heading>
            {good ? 'Great work!' : 'Keep going!'} {correct} / {total}
          </h3>
          <p class="muted m-0 mt-1">
            {isBest ? 'Your best score for this quiz' : best !== undefined ? `Best score: ${best}%` : ''}
            {good ? '' : ' · Aim for 80% — review the explanations below, then retake.'}
          </p>
          <button type="button" class="btn mt-3" onClick={onRetake}>
            ↻ Retake quiz
          </button>
        </div>
      </div>

      <h3 class="h2 mt-8">Review your answers</h3>
      <AnswerReview questions={questions} answers={attempt.answers} />
    </div>
  );
}

/** Per-question review: your answer, the key, every option's explanation and a link to the lesson section. */
export function AnswerReview({ questions, answers }: { questions: Question[]; answers: Attempt['answers'] }) {
  return (
    <ol class="review-list">
      {questions.map((q, i) => {
        const ok = scoreQuestion(q, answers[q.id]);
        const key = q.answer;
        const isCorrectOption = (id: string) => (q.type === 'matching' ? false : (key as string[]).includes(id));
        return (
          <li key={q.id} class="card review-item" data-correct={ok ? 'true' : 'false'}>
            <span class={`num-icon ${ok ? 'ok' : 'bad'}`} role="img" aria-label={ok ? 'Correct' : 'Incorrect'}>
              {ok ? '✓' : '✗'}
            </span>
            <div class="min-w-0 flex-1">
              <p class="m-0 font-medium">
                {i + 1}. {q.stem}
              </p>
              <p class="m-0 mt-2 text-sm">
                <strong>Your answer:</strong> {describe(q, answers[q.id])}
              </p>
              {!ok && (
                <p class="m-0 mt-1 text-sm">
                  <strong>Correct answer:</strong> {describe(q, key)}
                </p>
              )}
              <p class="m-0 mt-2 text-sm">{q.explanation}</p>
              <details class="opt-explain mt-2">
                <summary class="text-sm">Why each option is right or wrong</summary>
                <ul class="text-sm">
                  {q.options.map((o) => (
                    <li key={o.id} class={isCorrectOption(o.id) ? 'opt-correct' : undefined}>
                      <strong>{o.text}</strong>
                      {isCorrectOption(o.id) ? ' (correct)' : ''} — {o.explanation}
                    </li>
                  ))}
                </ul>
              </details>
              <a class="text-sm" href={lessonHref(q.lessonRef)}>
                Review in lesson →
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
