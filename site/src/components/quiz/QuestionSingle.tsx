// T051 — single answer: visible native radio group (arrow keys move + select, Tab leaves the group).
import type { Question } from '../../lib/types';
import Requirement, { revealClass } from './Requirement';

interface Props {
  q: Question;
  value?: string[];
  onChange: (v: string[]) => void;
  /** Answer submitted (practice): inputs disabled. */
  locked?: boolean;
  /** Show correct / wrong option states (practice feedback; never in the mock exam). */
  reveal?: boolean;
}

export default function QuestionSingle({ q, value, onChange, locked = false, reveal = false }: Props) {
  const selected = value?.[0];
  const key = q.answer as string[];
  return (
    <fieldset class="q-fieldset">
      <legend class="q-stem" tabIndex={-1}>{q.stem}</legend>
      <Requirement q={q} />
      <p class="q-hint">Choose one answer.</p>
      {q.options.map((o, i) => (
        <label key={o.id} class={`opt${selected === o.id ? ' opt-selected' : ''}${locked ? ' opt-locked' : ''}${reveal ? revealClass(key.includes(o.id), selected === o.id) : ''}`}>
          <input class="opt-input" type="radio" name={q.id} value={o.id} checked={selected === o.id} disabled={locked} onChange={() => onChange([o.id])} />
          <span class="num-icon" aria-hidden="true">
            {String.fromCharCode(65 + i)}
          </span>
          <span>{o.text}</span>
        </label>
      ))}
    </fieldset>
  );
}
