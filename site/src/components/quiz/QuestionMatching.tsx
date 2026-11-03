// T054 — matching: one labelled <select> per prompt.
import type { Question } from '../../lib/types';
import Requirement from './Requirement';

interface Props {
  q: Question;
  value?: Record<string, string>;
  onChange: (v: Record<string, string>) => void;
  locked?: boolean;
}

export default function QuestionMatching({ q, value = {}, onChange, locked = false }: Props) {
  const set = (optionId: string, target: string) => {
    const next = { ...value };
    if (target) next[optionId] = target;
    else delete next[optionId];
    onChange(next);
  };
  const done = q.options.filter((o) => value[o.id]).length;
  return (
    <fieldset class="q-fieldset">
      <legend class="q-stem" tabIndex={-1}>{q.stem}</legend>
      <div class="q-meta">
        <Requirement q={q} />
        <p class="q-hint" aria-live="polite">
          Match each item · {done} of {q.options.length} matched
        </p>
      </div>
      <div class="match-grid">
        {q.options.map((o, i) => (
          <div key={o.id} class={`match-row${value[o.id] ? ' opt-selected' : ''}`}>
            <label class="match-label" for={`${q.id}-${o.id}`}>
              <span class="num-icon" aria-hidden="true">
                {String.fromCharCode(65 + i)}
              </span>
              <span>{o.text}</span>
            </label>
            <select id={`${q.id}-${o.id}`} class="match-select" disabled={locked} value={value[o.id] ?? ''} onChange={(e) => set(o.id, (e.target as HTMLSelectElement).value)}>
              <option value="">Choose…</option>
              {q.matchTargets?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.text}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </fieldset>
  );
}
