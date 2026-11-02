// T051 — single answer: native radio group (arrow keys move + select, Tab leaves the group).
import type { Question } from '../../lib/types';

interface Props {
  q: Question;
  value?: string[];
  onChange: (v: string[]) => void;
}

export default function QuestionSingle({ q, value, onChange }: Props) {
  const selected = value?.[0];
  return (
    <fieldset class="q-fieldset">
      <legend class="q-stem" tabIndex={-1}>{q.stem}</legend>
      <p class="q-hint">Choose one answer.</p>
      {q.options.map((o, i) => (
        <label key={o.id} class={`opt${selected === o.id ? ' opt-selected' : ''}`}>
          <input class="sr-only" type="radio" name={q.id} value={o.id} checked={selected === o.id} onChange={() => onChange([o.id])} />
          <span class="num-icon" aria-hidden="true">
            {String.fromCharCode(65 + i)}
          </span>
          <span>{o.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
