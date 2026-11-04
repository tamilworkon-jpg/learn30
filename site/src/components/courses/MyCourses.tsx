// Learn30 sidebar on platform pages (catalogue, settings, login): "My courses" — the courses the learner
// has started (from the per-course summary in the page bootstrap). Nothing is rendered when signed out,
// when nothing has been started, or when the server sends no summary.
import { useEffect, useState } from 'preact/hooks';
import { readSummary, type Summary } from '../../lib/course-summary';

interface Item {
  id: string;
  shortTitle: string;
  title: string;
  lengthDays: number;
  href: string;
}

const ICON = 'M4 19.5A2.5 2.5 0 016.5 17H20V3H6.5A2.5 2.5 0 004 5.5zM4 19.5A2.5 2.5 0 006.5 22H20v-5';

export default function MyCourses({ courses }: { courses: Item[] }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => setSummary(readSummary()), []);
  // Started = a day done or a lesson opened (a progress record alone is created on first visit).
  const mine = summary ? courses.filter((c) => summary[c.id] && (summary[c.id].completed > 0 || !!summary[c.id].lastPosition)) : [];
  if (!mine.length) return null;
  return (
    <div class="nav-group" role="group" aria-labelledby="nav-mine-h" data-my-courses>
      <p class="nav-group-h" id="nav-mine-h">
        My courses
      </p>
      {mine.map((c) => (
        <a key={c.id} href={c.href} title={`${c.title} · ${summary![c.id].completed} of ${c.lengthDays} days`} data-my-course={c.id}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d={ICON} />
          </svg>
          <span class="nav-label">
            {c.shortTitle}
            <span class="sr-only">
              , {summary![c.id].completed} of {c.lengthDays} days done
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}
