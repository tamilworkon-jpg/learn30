// T082 — FR-026: optional 1–5 engagement rating at the end of a weekly review, saved to `ratings.week-N`.
import { useEffect, useState } from 'preact/hooks';
import { getStore } from '../../lib/progress/store';

interface Props {
  week: number;
}

const WORDS = ['', 'Not engaging', 'Slightly engaging', 'OK', 'Engaging', 'Very engaging'];

export default function RatingPrompt({ week }: Props) {
  const key = `week-${week}`;
  const [value, setValue] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setValue(getStore().get().ratings[key]);
    setReady(true);
  }, [key]);

  const choose = (n: number) => {
    getStore().setRating(key, n);
    setValue(n);
    setSaved(true);
  };

  return (
    <div class="card rating" data-ready={ready ? 'true' : undefined} data-rating={value ?? ''}>
      <fieldset class="q-fieldset">
        <legend class="font-semibold">How engaging was Week {week}? (optional)</legend>
        <p class="muted text-sm m-0 mt-1">
          Your rating stays on this device with your progress and appears on the dashboard.
        </p>
        <div class="rating-stars mt-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} class={`rating-star${value !== undefined && n <= value ? ' on' : ''}`}>
              <input
                type="radio"
                class="sr-only"
                name={`rating-${key}`}
                value={n}
                checked={value === n}
                aria-label={`${n} of 5 — ${WORDS[n]}`}
                onChange={() => choose(n)}
              />
              <span aria-hidden="true">{value !== undefined && n <= value ? '★' : '☆'}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p class="m-0 mt-2 text-sm" role="status">
        {saved && value
          ? `Thanks — saved your rating: ${value} of 5 (${WORDS[value]}).`
          : value
            ? `Your rating: ${value} of 5. Change it any time.`
            : ''}
      </p>
    </div>
  );
}
