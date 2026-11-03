// What the question asks for, above its options: "Single answer · choose 1", "Multiple answers · choose 2"…
import { requirement } from '../../lib/quiz-state';
import type { Question } from '../../lib/types';

export default function Requirement({ q }: { q: Question }) {
  const r = requirement(q);
  return (
    <p class="q-req" data-requirement={r.kind}>
      <span class="q-req-icon" aria-hidden="true">
        {r.kind === 'single' ? '◉' : r.kind === 'multi' ? '☑' : r.kind === 'ordering' ? '⇅' : '⇄'}
      </span>
      {r.label}
    </p>
  );
}

/** Per-option state class once a practice answer is revealed. */
export function revealClass(correct: boolean, chosen: boolean): string {
  if (correct) return ' opt-correct';
  return chosen ? ' opt-wrong' : '';
}
