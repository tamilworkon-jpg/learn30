// T053 — ordering: move items with Up/Down buttons (keyboard: Tab to a button, Enter/Space); focus follows the item.
import { useEffect, useRef, useState } from 'preact/hooks';
import { displayOrder } from '../../lib/quiz-state';
import type { Question } from '../../lib/types';

interface Props {
  q: Question;
  value?: string[];
  onChange: (v: string[]) => void;
}

export default function QuestionOrdering({ q, value, onChange }: Props) {
  const order = value && value.length === q.options.length ? value : displayOrder(q);
  const text = (id: string) => q.options.find((o) => o.id === id)?.text ?? id;
  const [announce, setAnnounce] = useState('');
  const focusAfter = useRef<{ id: string; dir: 'up' | 'down'; to: number } | null>(null);
  const list = useRef<HTMLOListElement>(null);

  // Restore focus only once the DOM shows the item at its new position: the announcement state can
  // re-render this component before the parent applies the new order, and moving a node drops focus.
  useEffect(() => {
    const f = focusAfter.current;
    if (!f || !list.current) return;
    const row = list.current.querySelector<HTMLElement>(`[data-item="${f.id}"]`);
    if (!row || list.current.children[f.to] !== row) return;
    focusAfter.current = null;
    const btn = row?.querySelector<HTMLButtonElement>(`[data-dir="${f.dir}"]:not([disabled])`) ?? row?.querySelector<HTMLButtonElement>('button:not([disabled])');
    btn?.focus();
  });

  const move = (i: number, delta: -1 | 1) => {
    const j = i + delta;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    focusAfter.current = { id: order[i], dir: delta < 0 ? 'up' : 'down', to: j };
    setAnnounce(`${text(order[i])} moved to position ${j + 1} of ${order.length}.`);
    onChange(next);
  };

  return (
    <fieldset class="q-fieldset">
      <legend class="q-stem" tabIndex={-1}>{q.stem}</legend>
      <p class="q-hint">Put the items in order using the arrow buttons (top = first).{value ? '' : ' Move at least one item to record your answer.'}</p>
      <ol class="order-list" ref={list}>
        {order.map((id, i) => (
          <li key={id} class="order-item" data-item={id}>
            <span class="num-icon" aria-hidden="true">
              {i + 1}
            </span>
            <span class="flex-1">{text(id)}</span>
            <span class="order-btns">
              <button type="button" class="icon-btn" data-dir="up" aria-label={`Move "${text(id)}" up`} disabled={i === 0} onClick={() => move(i, -1)}>
                ↑
              </button>
              <button type="button" class="icon-btn" data-dir="down" aria-label={`Move "${text(id)}" down`} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
                ↓
              </button>
            </span>
          </li>
        ))}
      </ol>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
    </fieldset>
  );
}
