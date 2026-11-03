// W4 (FR-026) — weekly engagement ratings saved on review days, shown on the dashboard once any week is rated.
import type { Progress } from '../../lib/types';

interface Props {
  ratings: Progress['ratings'];
}

export default function Ratings({ ratings }: Props) {
  const weeks = Object.entries(ratings ?? {})
    .filter(([k, v]) => /^week-[1-4]$/.test(k) && Number.isInteger(v))
    .sort(([a], [b]) => a.localeCompare(b));
  if (weeks.length === 0) return null;
  return (
    <section class="card dash-ratings" data-ratings>
      <h2 class="h2 m-0">Your module ratings</h2>
      <ul class="dash-ratings-list">
        {weeks.map(([key, value]) => {
          const n = Number(key.slice(5));
          return (
            <li key={key} data-week-rating={n}>
              <span>Module {n}</span>
              <span class="stars" role="img" aria-label={`Module ${n}: ${value} out of 5`}>
                {'★'.repeat(value)}
                <span class="stars-off">{'★'.repeat(5 - value)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
