import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { trackSections } from '../../src/lib/progress/section-tracker';

// T063 — R1 section ≥50% visible for 3 s → markSectionViewed + setLastPosition; R2 <3 s → nothing.
type Cb = (entries: Partial<IntersectionObserverEntry>[]) => void;
let cb: Cb;
const observed: Element[] = [];
class FakeIO {
  constructor(c: Cb) {
    cb = c;
  }
  observe(el: Element) {
    observed.push(el);
  }
  unobserve() {}
  disconnect() {
    observed.length = 0;
  }
}

const rect = (height: number) => ({ height }) as DOMRectReadOnly;
const vis = (target: Element, ratio: number, visibleHeight = 100, viewport = 800) =>
  ({ target, intersectionRatio: ratio, isIntersecting: ratio > 0, intersectionRect: rect(visibleHeight), rootBounds: rect(viewport) }) as Partial<IntersectionObserverEntry>;

function setup() {
  document.body.replaceChildren();
  const els = ['recap', 'hands-on', 'exam-tips'].map((id) => {
    const s = document.createElement('section');
    s.id = id;
    document.body.append(s);
    return s;
  });
  const store = { markSectionViewed: vi.fn(), setLastPosition: vi.fn() };
  const stop = trackSections({ day: 3, sections: els, store, Observer: FakeIO as unknown as typeof IntersectionObserver });
  return { els, store, stop };
}

describe('section tracker (T063)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('observes every section', () => {
    setup();
    expect(observed.map((e) => e.id)).toEqual(['recap', 'hands-on', 'exam-tips']);
  });

  it('R1 ≥50% visible for 3 s records viewed + last position', () => {
    const { els, store } = setup();
    cb([vis(els[1], 0.6)]);
    vi.advanceTimersByTime(3000);
    expect(store.markSectionViewed).toHaveBeenCalledWith(3, 'hands-on');
    expect(store.setLastPosition).toHaveBeenCalledWith(3, 'hands-on');
  });

  it('R1 a section taller than the viewport counts when it fills ≥50% of the viewport', () => {
    const { els, store } = setup();
    cb([vis(els[1], 0.2, 600, 800)]);
    vi.advanceTimersByTime(3000);
    expect(store.markSectionViewed).toHaveBeenCalledWith(3, 'hands-on');
  });

  it('R2 visible for less than 3 s records nothing', () => {
    const { els, store } = setup();
    cb([vis(els[0], 0.9)]);
    vi.advanceTimersByTime(2900);
    cb([vis(els[0], 0.3, 100)]);
    vi.advanceTimersByTime(5000);
    expect(store.markSectionViewed).not.toHaveBeenCalled();
    expect(store.setLastPosition).not.toHaveBeenCalled();
  });

  it('R2 below 50% visible never records', () => {
    const { els, store } = setup();
    cb([vis(els[0], 0.4, 100)]);
    vi.advanceTimersByTime(10000);
    expect(store.markSectionViewed).not.toHaveBeenCalled();
  });

  it('last position is the topmost section that dwelled when several qualify together', () => {
    const { els, store } = setup();
    cb([vis(els[1], 0.8), vis(els[2], 1)]);
    vi.advanceTimersByTime(3000);
    expect(store.markSectionViewed).toHaveBeenCalledWith(3, 'exam-tips');
    expect(store.setLastPosition).toHaveBeenLastCalledWith(3, 'hands-on');
  });

  it('last position prefers the section filling most of the screen over a short one peeking in above', () => {
    const { els, store } = setup();
    cb([vis(els[0], 1, 120), vis(els[1], 0.3, 640)]);
    vi.advanceTimersByTime(3000);
    expect(store.markSectionViewed).toHaveBeenCalledWith(3, 'recap');
    expect(store.setLastPosition).toHaveBeenLastCalledWith(3, 'hands-on');
  });

  it('stop() cancels pending timers', () => {
    const { els, store, stop } = setup();
    cb([vis(els[1], 0.8)]);
    stop();
    vi.advanceTimersByTime(5000);
    expect(store.markSectionViewed).not.toHaveBeenCalled();
  });
});
