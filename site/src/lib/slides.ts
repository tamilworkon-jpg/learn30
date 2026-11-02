// T182 — pure parts of the lesson slide pager (DOM-free so they can be unit tested).

export interface SlideBlock<T> {
  el: T;
  /** Container whose children are paged individually (lists, the lab). Tables use `splitIfNeeded`. */
  children?: SlideBlock<T>[];
  /** Keep whole when it fits a page; only page its children when it is taller than an empty page. */
  splitIfNeeded?: boolean;
  /** Start a new page here unless the current page is empty (sub-headings → one topic per slide). */
  breakBefore?: boolean;
  /** Never the last leaf on a page (headings, "…:" lead-ins). */
  keepWithNext?: boolean;
}

/**
 * Greedy pagination. `fits(leaves)` must report whether the given leaves (plus the group's always-visible
 * header) fit one page; it is called with growing arrays, so a DOM implementation can apply them
 * incrementally. `shrink(leaf)` is called for an atomic block that is taller than an empty page; it gets
 * a page of its own (plus any carried heading, passed as `page`). `explode(leaf)` may first offer
 * smaller parts of an oversize leaf (a long paragraph's sentences).
 */
export function paginate<T>(blocks: SlideBlock<T>[], fits: (leaves: T[]) => boolean, shrink?: (leaf: T, page: T[]) => boolean | void, explode?: (leaf: T) => SlideBlock<T>[] | null): T[][] {
  const pages: T[][] = [];
  const keep = new Set<T>();
  let cur: T[] = [];
  const flush = () => {
    if (cur.length) pages.push(cur);
    cur = [];
  };
  const contentful = () => cur.some((l) => !keep.has(l));

  const place = (b: SlideBlock<T>) => {
    if (b.breakBefore && contentful()) flush();
    if (b.children?.length && !b.splitIfNeeded) {
      b.children.forEach(place);
      return;
    }
    if (b.keepWithNext) keep.add(b.el);
    cur.push(b.el);
    if (fits(cur)) return;
    cur.pop();
    // Doesn't fit here. Carry trailing keep-with-next leaves along to the next page.
    const carry: T[] = [];
    while (cur.length && keep.has(cur[cur.length - 1])) carry.unshift(cur.pop()!);
    if (!fits([b.el])) {
      // Taller than a whole page: continue it part by part (table rows, sentences), starting on this page.
      const parts = b.splitIfNeeded && b.children?.length ? b.children : explode?.(b.el);
      if (parts?.length) {
        cur.push(...carry);
        parts.forEach(place);
        return;
      }
    }
    flush();
    cur = [...carry, b.el];
    if (fits(cur)) return;
    if (carry.length && fits([b.el])) {
      // Lead-in + block don't fit together: the lead-in keeps its page rather than shrinking the block.
      pages.push(carry);
      cur = [b.el];
      return;
    }
    // Oversize: shrink it to fit (together with its lead-in, if any; alone if even that fails).
    if (shrink?.(b.el, cur) === false && carry.length) {
      pages.push(carry);
      cur = [b.el];
      shrink(b.el, cur);
    }
    flush(); // nothing else joins that page
  };

  blocks.forEach(place);
  flush();
  return pages.length ? pages : [[]];
}

export function parseSlideHash(hash: string): number | null {
  const m = /^#slide-(\d+)$/.exec(hash);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 ? n - 1 : null;
}

interface KeyLike {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export function keyAction(e: KeyLike): 'next' | 'prev' | null {
  if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return null;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') return 'next';
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') return 'prev';
  return null;
}

/** dx/dy = end − start of a touch gesture (px). */
export function swipeAction(dx: number, dy: number): 'next' | 'prev' | null {
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? 'next' : 'prev';
}

/** Bold terms for the "Key terms on this slide" strip: trimmed, case-insensitively unique, short. */
export function keyTerms(texts: string[], max = 5): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of texts) {
    const t = raw.replace(/\s+/g, ' ').trim().replace(/[:.,;]$/, '');
    if (!t || t.length > 40 || seen.has(t.toLowerCase())) continue;
    seen.add(t.toLowerCase());
    out.push(t);
    if (out.length === max) break;
  }
  return out;
}
