// Marking a day complete — shared by the lesson's "Mark complete" card and the quiz's "What's next" panel:
// updates the day, the streak (store) and badges, and returns what to celebrate.
import { earnedBadges, newBadges, type BadgeWeek } from './badges';
import { getStore } from './progress/store';
import { currentStreak, localDate } from './streak';

export interface DayCompletion {
  streak: number;
  badges: string[];
}

export function completeDay(day: number, weeks: BadgeWeek[], totalDays: number): DayCompletion {
  const store = getStore();
  const before = [...store.get().badges];
  store.markDayComplete(day);
  const earned = earnedBadges(store.get(), weeks, totalDays);
  store.awardBadges(earned);
  return { streak: currentStreak(store.get().streak, localDate()), badges: newBadges(before, earned) };
}

export const isDayComplete = (day: number) => getStore().get().days[String(day)]?.status === 'completed';
