// Learn30 — the course whose progress the Settings page shows (export / import / reset, schedule).
// One shared choice for every settings card; defaults to the course studied most recently.
import { useEffect, useState } from 'preact/hooks';
import { getBootstrap } from '../../lib/bootstrap';
import { loadStore, type Store } from '../../lib/progress/store';
import { DEFAULT_COURSE_ID } from '../../lib/routes';

const KEY = 'aip-settings-course';
type Listener = (id: string) => void;
const listeners = new Set<Listener>();
let chosen: string | null = null;

/** The most recently saved course in the bootstrap summary, else the first course. */
export function defaultChoice(known: string[]): string {
  try {
    const last = sessionStorage.getItem(KEY);
    if (last && known.includes(last)) return last;
  } catch {
    /* no session storage */
  }
  const summary = getBootstrap().summary?.courses ?? {};
  const recent = Object.entries(summary)
    .filter(([id]) => known.includes(id))
    .sort((a, b) => b[1].updatedAt.localeCompare(a[1].updatedAt))[0]?.[0];
  return recent ?? (known.includes(DEFAULT_COURSE_ID) ? DEFAULT_COURSE_ID : (known[0] ?? DEFAULT_COURSE_ID));
}

export function chooseCourse(id: string) {
  chosen = id;
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    /* fine */
  }
  listeners.forEach((l) => l(id));
}

/** The chosen course id (follows the picker). */
export function useChosenCourse(known: string[]): string {
  const [id, setId] = useState(() => (chosen ??= defaultChoice(known)));
  useEffect(() => {
    listeners.add(setId);
    return () => {
      listeners.delete(setId);
    };
  }, []);
  return id;
}

/** The chosen course's store (loaded from the server when the page doesn't carry it). */
export function useChosenStore(known: string[]): { courseId: string; store: Store | null; error: string } {
  const courseId = useChosenCourse(known);
  const [state, setState] = useState<{ id: string; store: Store | null; error: string }>({ id: courseId, store: null, error: '' });
  useEffect(() => {
    let live = true;
    setState({ id: courseId, store: null, error: '' });
    loadStore(courseId)
      .then((store) => live && setState({ id: courseId, store, error: '' }))
      .catch(() => live && setState({ id: courseId, store: null, error: 'Could not load this course’s progress. Reload the page to try again.' }));
    return () => {
      live = false;
    };
  }, [courseId]);
  return { courseId, store: state.id === courseId ? state.store : null, error: state.error };
}
