// T111 — celebration toast with CSS-only confetti (no external assets). With prefers-reduced-motion
// the confetti isn't rendered and the toast doesn't animate (CSS media query as a second guard).
import { useEffect, useRef, useState } from 'preact/hooks';
import { BADGES } from '../../lib/badges';

interface Props {
  title: string;
  streak?: number;
  badges?: string[];
  onClose: () => void;
}

const PIECES = 18;

export default function Celebrate({ title, streak = 0, badges = [], onClose }: Props) {
  const [reduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div class="celebrate" role="status" data-celebrate data-motion={reduced ? 'reduced' : 'full'}>
      {!reduced && (
        <div class="confetti" aria-hidden="true">
          {Array.from({ length: PIECES }, (_, i) => (
            <i key={i} />
          ))}
        </div>
      )}
      <p class="celebrate-title m-0">🎉 {title}</p>
      {streak > 0 && <p class="m-0">🔥 {streak}-day streak — keep it going!</p>}
      {badges.map((id) => (
        <p class="m-0 font-semibold" key={id}>
          {BADGES[id]?.emoji} New badge: {BADGES[id]?.label ?? id}
        </p>
      ))}
      <button type="button" class="btn btn-ghost celebrate-close" ref={closeRef} onClick={onClose}>
        Close
      </button>
    </div>
  );
}
