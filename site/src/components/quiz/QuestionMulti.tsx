// T052 — multiple response: visible checkboxes, "Select N" hint with a running count; once N are chosen
// the others are disabled until one is unticked.
import type { Question } from '../../lib/types';
import Requirement, { revealClass } from './Requirement';

interface Props {
  q: Question;
  value?: string[];
  onChange: (v: string[]) => void;
  locked?: boolean;
  reveal?: boolean;
}

const WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE'];

export default function QuestionMulti({ q, value = [], onChange, locked = false, reveal = false }: Props) {
  const need = (q.answer as string[]).length;
  const full = value.length >= need;
  const toggle = (id: string) => {
    if (!value.includes(id) && full) return;
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    // Keep option order stable so the stored answer is deterministic.
    onChange(q.options.map((o) => o.id).filter((oid) => next.includes(oid)));
  };
  const key = q.answer as string[];
  return (
    <fieldset class="q-fieldset">
      <legend class="q-stem" tabIndex={-1}>{q.stem}</legend>
      <Requirement q={q} />
      <p class="q-hint" aria-live="polite">
        Select {WORDS[need] ?? need} · {value.length} selected
        {full && !locked && (
          <span class="q-limit" data-limit>
            {' '}
            · You've chosen {value.length} of {need} — untick one to change
          </span>
        )}
      </p>
      {q.options.map((o, i) => {
        const on = value.includes(o.id);
        const off = locked || (full && !on);
        return (
          <label key={o.id} class={`opt${on ? ' opt-selected' : ''}${off ? ' opt-locked' : ''}${reveal ? revealClass(key.includes(o.id), on) : ''}`}>
            <input class="opt-input" type="checkbox" name={q.id} value={o.id} checked={on} disabled={off} onChange={() => toggle(o.id)} />
            <span class="num-icon" aria-hidden="true">
              {String.fromCharCode(65 + i)}
            </span>
            <span>{o.text}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
