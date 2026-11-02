import { course, pad } from './data';

/** `day-01#explanation` → link to that lesson section; bare `day-12` → the day page (lesson may still be in progress). */
export function lessonLink(ref: string): { href: string; label: string; title: string } {
  const [dayPart, section] = ref.split('#');
  const day = Number(dayPart.slice(4));
  const title = course.days.find((d) => d.day === day)?.title ?? '';
  return { href: `/day/${pad(day)}${section ? `#${section}` : ''}`, label: `Day ${day}`, title };
}

/** Lower-cased haystack for the client-side filter. */
export const searchText = (...parts: (string | string[] | undefined)[]) =>
  parts
    .flat()
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
