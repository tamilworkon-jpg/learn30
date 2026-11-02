// T110 — badge shelf: earned badges in colour, locked ones muted (no opacity, so text keeps contrast).
import { BADGE_ORDER, BADGES } from '../../lib/badges';

export default function Badges({ earned }: { earned: string[] }) {
  const has = new Set(earned);
  return (
    <div class="card" data-badges>
      <div class="flex items-baseline justify-between gap-2 mb-2">
        <h3 class="font-semibold m-0">Badges</h3>
        <span class="muted text-sm">
          {has.size} of {BADGE_ORDER.length} earned
        </span>
      </div>
      <ul class="badge-grid" role="list">
        {BADGE_ORDER.map((id) => {
          const b = BADGES[id];
          const on = has.has(id);
          return (
            <li key={id} class={`badge ${on ? 'is-earned' : 'is-locked'}`} data-badge={id} data-earned={String(on)} title={b.description}>
              <span class="badge-emoji" aria-hidden="true">
                {b.emoji}
              </span>
              <span class="badge-label">{b.label}</span>
              <span class="sr-only">{on ? `: earned — ${b.description}` : ': locked'}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
