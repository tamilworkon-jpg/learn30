// T089 — question palette: jump to any question; answered / flagged / current states (not colour alone: labels + legend).
import { isAnswered } from '../../lib/quiz-state';
import type { Answer, Question } from '../../lib/types';

interface Props {
  questions: Question[];
  answers: Record<string, Answer>;
  flagged: string[];
  current: number;
  onJump: (index: number) => void;
}

export default function Palette({ questions, answers, flagged, current, onJump }: Props) {
  return (
    <nav aria-label="Question palette">
      <div class="palette">
        {questions.map((q, i) => {
          const answered = isAnswered(q, answers[q.id]);
          const flag = flagged.includes(q.id);
          const cls = [
            'pal',
            answered ? 'answered' : '',
            flag ? 'flagged' : '',
            i === current ? 'current' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={q.id}
              type="button"
              class={cls}
              data-q={i + 1}
              aria-current={i === current ? 'step' : undefined}
              aria-label={`Question ${i + 1}, ${answered ? 'answered' : 'not answered'}${flag ? ', flagged' : ''}`}
              onClick={() => onJump(i)}
            >
              {i + 1}
              {flag && <span aria-hidden="true">⚑</span>}
            </button>
          );
        })}
      </div>
      <ul class="pal-legend" aria-hidden="true">
        <li>
          <span class="pal answered" /> Answered
        </li>
        <li>
          <span class="pal flagged" /> Flagged
        </li>
        <li>
          <span class="pal" /> Not answered
        </li>
        <li>
          <span class="pal current" /> Current
        </li>
      </ul>
    </nav>
  );
}
