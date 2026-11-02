// T090 — review before submit: flagged and unanswered questions with jump links, then submit.
import { useEffect, useRef } from 'preact/hooks';
import { isAnswered } from '../../lib/quiz-state';
import type { Answer, Question } from '../../lib/types';

interface Props {
  questions: Question[];
  answers: Record<string, Answer>;
  flagged: string[];
  onJump: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}

function NumberList({
  items,
  label,
  onJump,
}: {
  items: number[];
  label: string;
  onJump: (i: number) => void;
}) {
  if (!items.length) return <p class="muted m-0 mt-2 text-sm">None.</p>;
  return (
    <ul class="mock-review-list" aria-label={label}>
      {items.map((i) => (
        <li key={i}>
          <button type="button" class="pal" aria-label={`Go to question ${i + 1}`} onClick={() => onJump(i)}>
            {i + 1}
          </button>
        </li>
      ))}
    </ul>
  );
}

export default function ReviewScreen({ questions, answers, flagged, onJump, onBack, onSubmit }: Props) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const flaggedIdx = questions.map((q, i) => (flagged.includes(q.id) ? i : -1)).filter((i) => i >= 0);
  const unansweredIdx = questions
    .map((q, i) => (isAnswered(q, answers[q.id]) ? -1 : i))
    .filter((i) => i >= 0);
  const answered = questions.length - unansweredIdx.length;

  return (
    <div class="mock-review" data-mock-review>
      <h2 class="h2 m-0" tabIndex={-1} ref={heading}>
        Review before you submit
      </h2>
      <p class="m-0 mt-1">
        {answered} of {questions.length} answered · {flaggedIdx.length} flagged · {unansweredIdx.length}{' '}
        unanswered
      </p>
      <div class="grid gap-4 md:grid-cols-2 mt-4">
        <div class="card" data-review-flagged>
          <h3 class="font-semibold text-base m-0">⚑ Flagged for review ({flaggedIdx.length})</h3>
          <NumberList items={flaggedIdx} label="Flagged questions" onJump={onJump} />
        </div>
        <div class="card" data-review-unanswered>
          <h3 class="font-semibold text-base m-0">Unanswered ({unansweredIdx.length})</h3>
          <NumberList items={unansweredIdx} label="Unanswered questions" onJump={onJump} />
        </div>
      </div>
      {unansweredIdx.length > 0 && (
        <p class="m-0 mt-4 text-sm">Unanswered questions count as incorrect, just like the real exam.</p>
      )}
      <div class="mock-actions">
        <button type="button" class="btn btn-ghost" onClick={onBack}>
          ← Back to questions
        </button>
        <button type="button" class="btn" onClick={onSubmit}>
          Submit exam
        </button>
      </div>
    </div>
  );
}
