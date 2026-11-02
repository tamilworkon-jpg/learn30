// T109 — study streak line for the progress card.
import { currentStreak, localDate } from '../../lib/streak';
import type { Progress } from '../../lib/types';

export default function Streak({ streak }: { streak: Progress['streak'] }) {
  const now = currentStreak(streak, localDate());
  return (
    <div class="streak" data-streak={now}>
      <p class="m-0 font-semibold">{now > 0 ? `🔥 ${now}-day streak` : 'No streak yet today'}</p>
      <p class="muted m-0 text-sm">{streak.longest > 0 ? `Longest: ${streak.longest} ${streak.longest === 1 ? 'day' : 'days'}` : 'Complete a day to start one'}</p>
    </div>
  );
}
