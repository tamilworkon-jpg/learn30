// T088 — countdown to a persisted deadline: amber < 10 min, red < 2 min, screen-reader update every 5 min, onExpire at 0.
import { useEffect, useRef, useState } from 'preact/hooks';
import { announcement, formatClock, remainingMs, timerPhase } from '../../lib/mock';

interface Props {
  deadline: string;
  onExpire: () => void;
}

export default function Timer({ deadline, onExpire }: Props) {
  const [ms, setMs] = useState(() => remainingMs(deadline));
  const [said, setSaid] = useState('');
  const prev = useRef(ms);
  const fired = useRef(false);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    fired.current = false;
    prev.current = remainingMs(deadline);
    const tick = () => {
      const m = remainingMs(deadline);
      const text = announcement(prev.current, m);
      if (text) setSaid(text);
      prev.current = m;
      setMs(m);
      if (m <= 0 && !fired.current) {
        fired.current = true;
        expire.current();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [deadline]);

  const secs = Math.ceil(ms / 1000);
  const phase = timerPhase(ms);
  return (
    <>
      <span
        class={`pill timer${phase === 'normal' ? '' : ` timer-${phase}`}`}
        role="timer"
        data-phase={phase}
        aria-label={`Time remaining ${Math.floor(secs / 60)} minutes ${secs % 60} seconds`}
      >
        <span aria-hidden="true">⏱</span> {formatClock(ms)}
      </span>
      <span class="sr-only" aria-live="polite" data-timer-announce>
        {said}
      </span>
    </>
  );
}
