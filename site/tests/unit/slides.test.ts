import { describe, expect, it } from 'vitest';
import { keyAction, keyTerms, paginate, parseSlideHash, swipeAction, type SlideBlock } from '../../src/lib/slides';

// T182 — pure parts of the slide pager. `fits` is simulated with block heights against a page height.
const H: Record<string, number> = {};
const leaf = (id: string, h: number, extra: Partial<SlideBlock<string>> = {}): SlideBlock<string> => {
  H[id] = h;
  return { el: id, ...extra };
};
const fitsIn = (max: number, shrunk: Set<string> = new Set()) => (leaves: string[]) => leaves.reduce((s, l) => s + (shrunk.has(l) ? max / 2 : H[l]), 0) <= max;

describe('paginate', () => {
  it('packs leaves greedily into pages that fit', () => {
    const pages = paginate([leaf('a', 40), leaf('b', 40), leaf('c', 40), leaf('d', 40)], fitsIn(100));
    expect(pages).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('descends into containers (lists) so they continue on the next page', () => {
    const list: SlideBlock<string> = { el: 'ul', children: [leaf('li1', 30), leaf('li2', 30), leaf('li3', 30)] };
    const pages = paginate([leaf('p', 50), list], fitsIn(100));
    expect(pages).toEqual([['p', 'li1'], ['li2', 'li3']]);
  });

  it('starts a new page at a breakBefore block (h3) unless the page is empty', () => {
    const pages = paginate([leaf('h3a', 10, { breakBefore: true }), leaf('p1', 10), leaf('h3b', 10, { breakBefore: true }), leaf('p2', 10)], fitsIn(100));
    expect(pages).toEqual([['h3a', 'p1'], ['h3b', 'p2']]);
  });

  it('never leaves a keepWithNext block (heading, "…:" intro) at the bottom of a page', () => {
    const pages = paginate([leaf('p1', 60), leaf('intro', 20, { keepWithNext: true }), leaf('table', 50)], fitsIn(100));
    expect(pages).toEqual([['p1'], ['intro', 'table']]);
  });

  it('keeps a splitIfNeeded block (table) whole when it fits a page, else continues it row by row', () => {
    const small: SlideBlock<string> = { el: 't1', splitIfNeeded: true, children: [leaf('r1', 20), leaf('r2', 20)] };
    H.t1 = 40;
    const big: SlideBlock<string> = { el: 't2', splitIfNeeded: true, children: [leaf('r3', 60), leaf('r4', 60), leaf('r5', 60)] };
    H.t2 = 180;
    const pages = paginate([small, big], fitsIn(100));
    expect(pages).toEqual([['t1', 'r3'], ['r4'], ['r5']]);
  });

  it('gives an oversize atomic block its own page and asks for it to be shrunk', () => {
    const shrunk = new Set<string>();
    const pages = paginate([leaf('p', 30), leaf('diagram', 300), leaf('q', 30)], fitsIn(100, shrunk), (el) => shrunk.add(el));
    expect(pages).toEqual([['p'], ['diagram'], ['q']]);
    expect([...shrunk]).toEqual(['diagram']);
  });

  it('explodes an oversize leaf (long paragraph) into parts before shrinking it', () => {
    const shrunk = new Set<string>();
    const parts = [leaf('s1', 60), leaf('s2', 60), leaf('s3', 60)];
    H.long = 180;
    const pages = paginate([leaf('p', 30), leaf('long', 180)], fitsIn(100, shrunk), (el) => shrunk.add(el), (el) => (el === 'long' ? parts : null));
    expect(pages).toEqual([['p', 's1'], ['s2'], ['s3']]);
    expect(shrunk.size).toBe(0);
  });

  it('returns one empty page for a group without blocks (header-only teaser)', () => {
    expect(paginate([], fitsIn(100))).toEqual([[]]);
  });
});

describe('parseSlideHash', () => {
  it('reads #slide-n as a 0-based index', () => {
    expect(parseSlideHash('#slide-5')).toBe(4);
    expect(parseSlideHash('#slide-1')).toBe(0);
    expect(parseSlideHash('#slide-0')).toBeNull();
    expect(parseSlideHash('#examples')).toBeNull();
    expect(parseSlideHash('')).toBeNull();
  });
});

describe('keyAction', () => {
  const k = (key: string, extra: Partial<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }> = {}) => ({ key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...extra });
  it('maps arrows and page keys', () => {
    expect(keyAction(k('ArrowRight'))).toBe('next');
    expect(keyAction(k('PageDown'))).toBe('next');
    expect(keyAction(k('ArrowLeft'))).toBe('prev');
    expect(keyAction(k('PageUp'))).toBe('prev');
    expect(keyAction(k('ArrowDown'))).toBeNull();
  });
  it('ignores modified keys', () => {
    expect(keyAction(k('ArrowRight', { altKey: true }))).toBeNull();
    expect(keyAction(k('ArrowLeft', { ctrlKey: true }))).toBeNull();
  });
});

describe('swipeAction', () => {
  it('detects a horizontal swipe', () => {
    expect(swipeAction(-120, 10)).toBe('next');
    expect(swipeAction(120, -20)).toBe('prev');
  });
  it('ignores short or mostly vertical gestures', () => {
    expect(swipeAction(-30, 0)).toBeNull();
    expect(swipeAction(-80, 90)).toBeNull();
  });
});

describe('keyTerms', () => {
  it('dedupes, trims and caps the bold terms', () => {
    expect(keyTerms(['Features', ' Label ', 'features', 'Model', 'A very long bold sentence that is clearly not a key term at all'], 3)).toEqual(['Features', 'Label', 'Model']);
  });
});
