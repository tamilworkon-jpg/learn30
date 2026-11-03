// T051 — single answer: visible native radio group (arrow keys move + select, Tab leaves the group).
import type { Question } from '../../lib/types';
import Requirement from './Requirement';

interface Props {
  q: Question;
  value?: string[];
  onChange: (v: string[]) => void;
  /** Inputs disabled (read-only). */
  locked?: boolean;
}

export default function QuestionSingle({ q, value, onChange, locked = false }: Props) {
  const selected = value?.[0];
  return (
    <fieldset class="q-fieldset">
      <legend class="q-stem" tabIndex={-1}>
        {q.stem}
      </legend>
      <div class="q-meta">
        <Requirement q={q} />
        <p class="q-hint">Choose one answer.</p>
      </div>
      <div class="q-opts">
        {q.options.map((o, i) => (
          <label
            key={o.id}
            class={`opt${selected === o.id ? ' opt-selected' : ''}${locked ? ' opt-locked' : ''}`}
          >
            <input
              class="opt-input"
              type="radio"
              name={q.id}
              value={o.id}
              checked={selected === o.id}
              disabled={locked}
              onChange={() => onChange([o.id])}
            />
            <span class="num-icon" aria-hidden="true">
              {String.fromCharCode(65 + i)}
            </span>
            <span>{o.text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
