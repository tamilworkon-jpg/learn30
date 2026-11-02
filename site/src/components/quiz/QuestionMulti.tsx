// T052 — multiple response: checkboxes with a "Select N" hint and running count.
import type { Question } from '../../lib/types';

interface Props {
  q: Question;
  value?: string[];
  onChange: (v: string[]) => void;
}

const WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];

export default function QuestionMulti({ q, value = [], onChange }: Props) {
  const need = (q.answer as string[]).length;
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    // Keep option order stable so the stored answer is deterministic.
    onChange(q.options.map((o) => o.id).filter((oid) => next.includes(oid)));
  };
  return (
    <fieldset class="q-fieldset">
      <legend class="q-stem" tabIndex={-1}>{q.stem}</legend>
      <p class="q-hint" aria-live="polite">
        Select {WORDS[need] ?? need} · {value.length} selected
      </p>
      {q.options.map((o, i) => (
        <label key={o.id} class={`opt${value.includes(o.id) ? ' opt-selected' : ''}`}>
          <input class="sr-only" type="checkbox" name={q.id} value={o.id} checked={value.includes(o.id)} onChange={() => toggle(o.id)} />
          <span class="num-icon opt-box" aria-hidden="true">
            {value.includes(o.id) ? '✓' : String.fromCharCode(65 + i)}
          </span>
          <span>{o.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
