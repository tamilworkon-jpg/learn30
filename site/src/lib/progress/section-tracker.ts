// T068 — records a lesson section as viewed (and as the resume position) once it has been
// on screen for `dwellMs`. "On screen" = ≥50% of the section visible, or — for sections taller
// than the viewport — the section filling ≥50% of the viewport.
import type { Store } from './store';

interface Options {
  day: number;
  sections: Element[];
  store: Pick<Store, 'markSectionViewed' | 'setLastPosition'>;
  dwellMs?: number;
  Observer?: typeof IntersectionObserver;
}

const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

export function trackSections({ day, sections, store, dwellMs = 3000, Observer = IntersectionObserver }: Options): () => void {
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const dwelled = new Set<Element>(); // currently visible and past the dwell time
  const shown = new Map<Element, number>(); // latest visible height (px) per section

  const isVisible = (e: IntersectionObserverEntry) => {
    if (e.intersectionRatio >= 0.5) return true;
    const vh = e.rootBounds?.height ?? 0;
    return vh > 0 && e.intersectionRect.height >= vh / 2;
  };

  const fire = (el: Element) => {
    timers.delete(el);
    dwelled.add(el);
    store.markSectionViewed(day, el.id);
    // Resume at the settled section that fills most of the screen (ties → topmost), so a short
    // section peeking in above the one being read doesn't become the resume point.
    const settled = sections.filter((s) => dwelled.has(s));
    const max = Math.max(...settled.map((s) => shown.get(s) ?? 0));
    const best = settled.find((s) => (shown.get(s) ?? 0) === max) ?? el;
    store.setLastPosition(day, best.id);
  };

  const io = new Observer(
    (entries) => {
      for (const e of entries) {
        const el = e.target;
        shown.set(el, e.intersectionRect.height);
        if (isVisible(e)) {
          if (!timers.has(el) && !dwelled.has(el)) timers.set(el, setTimeout(() => fire(el), dwellMs));
        } else {
          clearTimeout(timers.get(el));
          timers.delete(el);
          dwelled.delete(el);
        }
      }
    },
    { threshold: THRESHOLDS },
  );
  sections.forEach((s) => io.observe(s));

  return () => {
    io.disconnect();
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
  };
}
