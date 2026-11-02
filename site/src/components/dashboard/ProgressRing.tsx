// T071 — overall completion ring (SVG attributes only; no inline styles under the CSP).
import type { ComponentChildren } from 'preact';

interface Props {
  percent: number;
  completed: number;
  total: number;
  children?: ComponentChildren;
}

const R = 50;
const CIRC = 2 * Math.PI * R;

export default function ProgressRing({ percent, completed, total, children }: Props) {
  const dash = (CIRC * Math.max(0, Math.min(100, percent))) / 100;
  return (
    <div class="card text-center progress-ring" data-progress-ring>
      <svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label={`${percent} percent complete`}>
        <circle class="ring-track" cx="60" cy="60" r={R} fill="none" stroke-width="12" />
        {percent > 0 && (
          <circle class="ring-value" cx="60" cy="60" r={R} fill="none" stroke-width="12" stroke-linecap="round" stroke-dasharray={`${dash.toFixed(1)} ${CIRC.toFixed(1)}`} transform="rotate(-90 60 60)" />
        )}
        <text x="60" y="68" text-anchor="middle" font-size="24" font-weight="700" fill="currentColor">
          {percent}%
        </text>
      </svg>
      <p class="m-0 font-semibold">
        {completed} of {total} days complete
      </p>
      {children}
    </div>
  );
}
