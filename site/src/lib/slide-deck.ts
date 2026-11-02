// T182 — client-side slide presentation of a server-rendered lesson article.
// The build-time HTML stays the full article (search, print, no-JS); this module only hides/shows
// blocks. Nothing is moved, so hydrated islands (QuizRunner, MarkComplete) keep working.
import { keyAction, keyTerms, paginate, parseSlideHash, swipeAction, type SlideBlock } from './slides';

export const VIEW_KEY = 'aip-ui:lesson-view';
export type LessonView = 'slides' | 'full';

export function readView(): LessonView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'full' ? 'full' : 'slides';
  } catch {
    return 'slides';
  }
}

const ILLUSTRATION: Record<string, string> = {
  recap: 'recap',
  orientation: 'orientation',
  objectives: 'objectives',
  explanation: 'explanation',
  diagram: 'diagram',
  examples: 'examples',
  realWorld: 'real-world',
  handsOn: 'hands-on',
  examTips: 'exam-tips',
  summary: 'summary',
  quiz: 'quiz',
  deepDive: 'deep-dive',
  finish: 'finish',
};
const VISUAL = 'img:not(.slide-illo), svg, figure, table, .console';
const KEYPOINT = '.callout-examTrap, .callout-tip, .callout-remember, .callout-realWorld';
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'LINK']);

interface Group {
  id: string;
  type: string;
  main: HTMLElement | null; // shown whenever the group is active
  header: HTMLElement; // focus target + slide title
  title: string;
  nodes: HTMLElement[]; // everything this group shows/hides
  extraRoots: HTMLElement[]; // roots outside `main` (lesson intro, finish blocks)
  blocks: () => SlideBlock<HTMLElement>[];
  single: boolean; // the quiz: one page
  scroll: boolean; // interactive content (quiz, finish) may grow, so its slide may scroll
  illo: HTMLImageElement;
  part: HTMLElement | null;
  deep?: HTMLDetailsElement;
}

interface Slide {
  group: Group;
  leaves: HTMLElement[];
  part: number;
  parts: number;
}

const kids = (el: Element) => [...el.children].filter((c): c is HTMLElement => c instanceof HTMLElement && !SKIP.has(c.tagName));

export function initSlideDeck(deck: HTMLElement) {
  const found = deck.querySelector<HTMLElement>('article[data-lesson-day]');
  const bar = deck.querySelector<HTMLElement>('.deck-bar');
  const controls = deck.querySelector<HTMLElement>('.deck-controls');
  if (!found || !bar || !controls) return;
  const article: HTMLElement = found;
  const prevBtn = controls.querySelector<HTMLButtonElement>('.deck-prev')!;
  const nextBtn = controls.querySelector<HTMLButtonElement>('.deck-next')!;
  const count = bar.querySelector<HTMLElement>('.deck-count')!;
  const mini = controls.querySelector<HTMLElement>('.deck-count-mini')!;
  const progress = bar.querySelector<HTMLProgressElement>('.deck-progress')!;
  const live = deck.querySelector<HTMLElement>('.deck-live')!;
  const viewBtns = [...bar.querySelectorAll<HTMLButtonElement>('[data-view]')];
  const root = document.documentElement;
  const day = Number(article.dataset.lessonDay);

  let view: LessonView = readView();
  let groups: Group[] | null = null;
  let slides: Slide[] = [];
  let index = 0;
  let paging = false;
  let settled = false; // the learner has navigated since the page loaded
  let strip: HTMLElement | null = null;
  const managed = new Set<HTMLElement>();
  const zoomed = new Set<HTMLElement>();

  // ---------- build the group model (once) ----------
  const illo = (type: string) => {
    const img = document.createElement('img');
    img.className = 'slide-illo slide-only';
    img.src = `/illustrations/${ILLUSTRATION[type] ?? 'explanation'}.svg`;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    return img;
  };
  const partLabel = (h: HTMLElement) => {
    const s = document.createElement('span');
    s.className = 'slide-part slide-only';
    h.append(s);
    return s;
  };

  const blockOf = (el: HTMLElement): SlideBlock<HTMLElement> => {
    const tag = el.tagName;
    if (tag === 'UL' || tag === 'OL') {
      const items = kids(el);
      if (tag === 'OL') {
        const start = Number(el.getAttribute('start') ?? 1);
        items.forEach((li, i) => li instanceof HTMLLIElement && !li.hasAttribute('value') && (li.value = start + i)); // numbering survives a split
      }
      return { el, children: items.map(blockOf) };
    }
    if (tag === 'TABLE') {
      const rows = [...el.querySelectorAll<HTMLElement>(':scope > tbody > tr')];
      return { el, splitIfNeeded: true, children: rows.map((r) => ({ el: r })) };
    }
    if (el.matches('.lab, .recap-card, .deep-body')) return { el, children: kids(el).map(blockOf) };
    if (/^H[3-6]$/.test(tag)) return { el, breakBefore: tag === 'H3', keepWithNext: true };
    if (el.matches(KEYPOINT)) el.classList.add('slide-keypoint');
    const text = el.textContent?.trim() ?? '';
    return { el, keepWithNext: tag === 'P' && text.endsWith(':') };
  };

  const collect = (g: Group, blocks: SlideBlock<HTMLElement>[]) => {
    const walk = (b: SlideBlock<HTMLElement>) => {
      g.nodes.push(b.el);
      b.children?.forEach(walk);
    };
    blocks.forEach(walk);
  };

  const build = (): Group[] => {
    const all = kids(article);
    const sections = all.filter((c) => c.hasAttribute('data-section-type'));
    if (!sections.length) return [];
    const first = all.indexOf(sections[0]);
    const last = all.indexOf(sections[sections.length - 1]);
    const intro = all.slice(0, first);
    const trailing = all.slice(last + 1);
    const out: Group[] = [];

    sections.forEach((sec, i) => {
      const type = sec.dataset.sectionType ?? 'explanation';
      const extraRoots = i === 0 ? intro : [];
      if (sec instanceof HTMLDetailsElement) {
        const summary = sec.querySelector<HTMLElement>(':scope > summary')!;
        const body = sec.querySelector<HTMLElement>(':scope > .deep-body');
        const img = illo(type);
        summary.append(img);
        const teaser = document.createElement('span');
        teaser.className = 'deep-teaser slide-only';
        teaser.textContent = 'Open it to go deeper — or choose Next to finish the day.';
        summary.append(teaser);
        const g: Group = {
          id: sec.id,
          type,
          main: sec,
          header: summary,
          title: summary.querySelector('.font-semibold')?.textContent?.trim() ?? 'Architect deep dive',
          nodes: [sec],
          extraRoots,
          blocks: () => (sec.open && body ? kids(body).map(blockOf) : []),
          single: false,
          scroll: false,
          illo: img,
          part: null,
          deep: sec,
        };
        if (body) {
          g.nodes.push(body);
          collect(g, kids(body).map(blockOf));
        }
        out.push(g);
        return;
      }
      const h = sec.querySelector<HTMLElement>(':scope > h2') ?? sec;
      h.tabIndex = -1;
      const img = illo(type);
      h.after(img);
      const content = kids(sec).filter((c) => c !== h && c !== img);
      const blocks = [...extraRoots, ...content].map(blockOf);
      const g: Group = {
        id: sec.id,
        type,
        main: sec,
        header: h,
        title: h.querySelector('span')?.textContent?.trim() ?? h.textContent?.trim() ?? '',
        nodes: [sec],
        extraRoots,
        blocks: () => blocks,
        single: !!sec.querySelector('astro-island'),
        scroll: !!sec.querySelector('astro-island'),
        illo: img,
        part: partLabel(h),
      };
      collect(g, blocks);
      out.push(g);
    });

    if (trailing.length) {
      const h = document.createElement('h2');
      h.className = 'h2 sec-head slide-only slide-finish-h';
      h.tabIndex = -1;
      h.textContent = `Finish Day ${day}`;
      trailing[0].before(h);
      const img = illo('finish');
      h.after(img);
      const blocks = trailing.map((el) => ({ el }));
      const g: Group = { id: 'finish', type: 'finish', main: null, header: h, title: h.textContent, nodes: [h, img], extraRoots: trailing, blocks: () => blocks, single: false, scroll: true, illo: img, part: null };
      collect(g, blocks);
      out.push(g);
    }
    for (const g of out) {
      if (g.main) managed.add(g.main);
      g.nodes.forEach((n) => managed.add(n));
    }

    strip = document.createElement('div');
    strip.className = 'key-strip slide-only';
    strip.setAttribute('aria-hidden', 'true');
    article.append(strip);
    return out;
  };

  // ---------- show one page ----------
  let shownGroup: Group | null = null;
  const showGroup = (g: Group) => {
    if (shownGroup === g) return;
    for (const n of managed) n.classList.add('slide-off');
    shownGroup = g;
  };
  const show = (g: Group, leaves: HTMLElement[]) => {
    showGroup(g);
    const on = new Set<HTMLElement>();
    if (g.main) on.add(g.main);
    if (g.type === 'finish') g.nodes.slice(0, 2).forEach((n) => on.add(n));
    const leafSet = new Set(leaves);
    for (const leaf of leaves) for (let n: HTMLElement | null = leaf; n && n !== article; n = n.parentElement) if (managed.has(n)) on.add(n);
    // A container shown whole (a table that fits) shows all of its rows.
    const inLeaf = (n: HTMLElement) => {
      for (let p = n.parentElement; p && p !== article; p = p.parentElement) if (leafSet.has(p)) return true;
      return false;
    };
    for (const n of g.nodes) n.classList.toggle('slide-off', !on.has(n) && !inLeaf(n));
    for (const r of g.extraRoots) r.classList.toggle('slide-off', !on.has(r));
  };

  const terms = (g: Group, leaves: HTMLElement[]) => (g.type === 'explanation' ? keyTerms(leaves.flatMap((l) => [...l.querySelectorAll('strong')].map((s) => s.textContent ?? '')), 5) : []);
  const hasVisual = (leaves: HTMLElement[]) => leaves.some((l) => l.matches(VISUAL) || !!l.querySelector(VISUAL) || !!l.parentElement?.closest('table, figure, .console'));
  const fits = (g: Group, leaves: HTMLElement[]) => {
    show(g, leaves);
    g.illo.classList.toggle('illo-off', hasVisual(leaves));
    return article.scrollHeight <= article.clientHeight;
  };
  const shrink = (g: Group, leaf: HTMLElement, page: HTMLElement[]) => {
    // Zoom on an inline sentence span can't shrink its line box: zoom the paragraph / list item instead.
    // Same for a table row: zoom the table.
    const target = leaf.tagName === 'TR' ? (leaf.closest('table') ?? leaf) : getComputedStyle(leaf).display === 'inline' ? (leaf.parentElement ?? leaf) : leaf;
    let z = Number(target.style.getPropertyValue('zoom') || 1);
    zoomed.add(target);
    while (z > 0.3 && !fits(g, page)) {
      z = Math.round((z - 0.05) * 100) / 100;
      target.style.setProperty('zoom', String(z));
    }
    return fits(g, page);
  };

  // A paragraph/list item taller than a slide is paged by sentence: its direct text is wrapped in
  // sentence spans once (inline, so the Full page view looks the same).
  const explode = (g: Group, el: HTMLElement): SlideBlock<HTMLElement>[] | null => {
    if (!el.dataset.slideSplit) {
      if (!/^(P|LI)$/.test(el.tagName) || [...el.children].some((c) => /^(P|UL|OL|DIV|TABLE|FIGURE|ASTRO-ISLAND)$/.test(c.tagName))) return null;
      const spans: HTMLElement[] = [];
      const mk = () => {
        const sp = document.createElement('span');
        sp.className = 'slide-sent';
        spans.push(sp);
        return sp;
      };
      let cur = mk();
      for (const n of [...el.childNodes]) {
        if (n.nodeType !== Node.TEXT_NODE) {
          cur.append(n);
          continue;
        }
        (n.textContent ?? '').split(/(?<=[.!?…])\s+(?=\S)/).forEach((t, i) => {
          if (i > 0) {
            cur.append(' ');
            cur = mk();
          }
          cur.append(t);
        });
      }
      const real = spans.filter((sp) => sp.textContent?.trim());
      if (real.length < 2) {
        el.replaceChildren(...spans.flatMap((sp) => [...sp.childNodes]));
        return null;
      }
      el.replaceChildren(...spans);
      el.dataset.slideSplit = 'true';
    }
    const parts = [...el.querySelectorAll<HTMLElement>(':scope > .slide-sent')];
    for (const sp of parts) {
      if (!managed.has(sp)) g.nodes.push(sp);
      managed.add(sp);
    }
    return parts.map((sp) => ({ el: sp }));
  };

  // ---------- pagination ----------
  const bottomBar = () => {
    const nav = document.querySelector<HTMLElement>('.sidebar');
    return nav && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().height : 0;
  };
  // The deck (compact title bar, skip notice, stage, controls) fits the viewport from where it starts, so a
  // slide is fully visible without scrolling the page; only if that leaves too little room (very short
  // windows) is the deck sized to the whole viewport and scrolled to the top.
  const MIN_STAGE = 260;
  const stageHeight = () => {
    const vh = window.innerHeight - bottomBar();
    const docTop = article.getBoundingClientRect().top + window.scrollY;
    const fromTop = Math.floor(vh - docTop - controls.offsetHeight - 12);
    const above = article.getBoundingClientRect().top - deck.getBoundingClientRect().top;
    const h = fromTop >= MIN_STAGE ? fromTop : Math.max(MIN_STAGE, Math.floor(vh - above - controls.offsetHeight - 16));
    article.style.height = `${h}px`;
    article.style.setProperty('--slide-img-max', `${Math.max(120, h - 150)}px`);
    article.classList.toggle('slide-short', h < 420);
  };

  const repaginate = () => {
    if (!groups) return;
    const anchor = slides[index];
    const anchorLeaf = anchor?.leaves[0];
    const placed = Math.abs(deck.getBoundingClientRect().top - 8) <= 2;
    paging = true;
    article.classList.remove('slide-scroll');
    article.classList.add('slide-measuring');
    stageHeight();
    zoomed.forEach((el) => el.style.removeProperty('zoom'));
    zoomed.clear();
    // Measure with every inner <details> open so expanding a lab answer never overflows its slide.
    const closed = [...article.querySelectorAll<HTMLDetailsElement>('details:not([open]):not(.deep-dive)')];
    closed.forEach((d) => (d.open = true));
    shownGroup = null;
    const next: Slide[] = [];
    for (const g of groups) {
      const blocks = g.blocks();
      const pages = g.single ? [blocks.map((b) => b.el)] : paginate(blocks, (l) => fits(g, l), (leaf, page) => shrink(g, leaf, page), (leaf) => explode(g, leaf));
      pages.forEach((leaves, i) => next.push({ group: g, leaves, part: i + 1, parts: pages.length }));
    }
    closed.forEach((d) => (d.open = false));
    article.classList.remove('slide-measuring');
    slides = next;
    paging = false;
    // Until the learner moves, a #slide-n deep link keeps pointing at slide n (late fonts/images re-page).
    const linked = settled ? null : fromHash(location.hash);
    if (linked !== null) return go(linked, { focus: false, scroll: true, replace: false });
    let i = anchorLeaf ? slides.findIndex((s) => s.leaves.some((l) => l === anchorLeaf || l.contains(anchorLeaf))) : -1;
    if (i < 0 && anchor) i = slides.findIndex((s) => s.group === anchor.group);
    go(Math.max(0, i), { focus: false, scroll: placed, replace: false });
  };

  // ---------- navigation ----------
  // Bring the whole deck on screen with the smallest scroll (none when it already fits).
  const deckInView = () => {
    const top = deck.getBoundingClientRect().top;
    const bottom = controls.getBoundingClientRect().bottom;
    const limit = window.innerHeight - bottomBar() - 4;
    let dy = 0;
    if (top < 0) dy = top - 8;
    else if (bottom > limit) dy = Math.min(bottom - limit, top - 8);
    if (Math.abs(dy) > 1) window.scrollTo({ top: window.scrollY + dy, behavior: 'instant' });
  };

  function go(i: number, opts: { focus: boolean; scroll: boolean; replace: boolean } = { focus: true, scroll: true, replace: true }) {
    if (!slides.length) return;
    if (opts.focus) settled = true;
    index = Math.max(0, Math.min(slides.length - 1, i));
    const s = slides[index];
    show(s.group, s.leaves);
    s.group.illo.classList.toggle('illo-off', hasVisual(s.leaves));
    if (s.group.part) s.group.part.textContent = s.parts > 1 ? `${s.part}/${s.parts}` : '';
    article.classList.toggle('slide-scroll', s.group.scroll);
    article.scrollTop = 0;
    const t = terms(s.group, s.leaves);
    if (strip) {
      strip.replaceChildren();
      strip.hidden = t.length < 3;
      if (t.length >= 3) {
        const label = document.createElement('span');
        label.className = 'key-strip-label';
        label.textContent = 'Key terms on this slide';
        strip.append(label, ...t.map((x) => Object.assign(document.createElement('span'), { className: 'key-term', textContent: x })));
        // One row only: drop the terms that wrapped.
        const row = label.offsetTop;
        [...strip.querySelectorAll<HTMLElement>('.key-term')].forEach((k) => k.offsetTop > row + 4 && k.remove());
        if (strip.querySelectorAll('.key-term').length < 2) strip.hidden = true;
        // Optional extra: only when it fits below the slide's content.
        const content = s.group.main ?? s.group.header;
        if (content.getBoundingClientRect().bottom > strip.getBoundingClientRect().top - 4) strip.hidden = true;
      }
    }
    const n = slides.length;
    count.textContent = `Slide ${index + 1} of ${n}`;
    mini.textContent = `${index + 1} / ${n}`;
    progress.max = n;
    progress.value = index + 1;
    progress.setAttribute('aria-label', `Slide ${index + 1} of ${n}`);
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === n - 1;
    article.dataset.slideSection = s.group.type === 'finish' ? (groups?.[groups.length - 2]?.id ?? '') : s.group.id;
    article.dataset.slideIndex = String(index + 1);
    document.dispatchEvent(new CustomEvent('slidechange', { detail: { index, section: s.group.id } }));
    if (opts.replace) history.replaceState(history.state, '', `#slide-${index + 1}`);
    if (opts.focus) {
      live.textContent = `Slide ${index + 1} of ${n}: ${s.group.title}${s.parts > 1 ? `, part ${s.part} of ${s.parts}` : ''}`;
      s.group.header.focus({ preventScroll: true });
    }
    if (opts.scroll) deckInView();
    markScrollable();
  }

  const fromHash = (hash: string): number | null => {
    const n = parseSlideHash(hash);
    if (n !== null) return Math.min(n, slides.length - 1);
    if (hash.length < 2) return null;
    let target: Element | null = null;
    try {
      target = document.getElementById(decodeURIComponent(hash.slice(1)));
    } catch {
      return null;
    }
    if (!target || !article.contains(target)) return null;
    const leafIdx = slides.findIndex((s) => s.leaves.some((l) => l === target || l.contains(target)));
    if (leafIdx >= 0 && !groups?.some((g) => g.main === target)) return leafIdx;
    const gi = slides.findIndex((s) => s.group.main === target || s.group.main?.contains(target!));
    return gi >= 0 ? gi : null;
  };

  // ---------- mode switching ----------
  const setButtons = () => viewBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));

  // The "you haven't finished yesterday" notice sits inside the deck in slide view, so it stays on screen.
  const notice = document.getElementById('skip-notice');
  const noticeHome = document.createComment('skip-notice');
  notice?.before(noticeHome);
  if (notice) new MutationObserver(() => later(0)).observe(notice, { attributes: true, attributeFilter: ['hidden'] });

  // The day title and "Planned for" line join the deck's title bar in slide view (one compact header).
  const title = document.querySelector<HTMLElement>('main h1');
  const planned = document.querySelector<HTMLElement>('main .planned-date');
  const titleSlot = bar.querySelector<HTMLElement>('.deck-title');
  const homes = new Map<HTMLElement, Comment>();
  for (const el of [title, planned]) {
    if (!el) continue;
    const c = document.createComment('deck-home');
    el.before(c);
    homes.set(el, c);
  }
  if (title) title.title = title.textContent?.trim() ?? ''; // full title on hover when the compact bar truncates it
  const dockTitle = (on: boolean) => homes.forEach((home, el) => (on && titleSlot ? titleSlot.append(el) : home.after(el)));

  // Re-page when the room changes: side bars collapsed/expanded, the title bar or notice growing.
  let lastDeckW = 0;
  const sizes = new Map<Element, number>();
  const ro = new ResizeObserver((entries) => {
    let changed = false;
    for (const e of entries) {
      if (e.target === deck) {
        const w = Math.round(e.contentRect.width);
        if (lastDeckW && w !== lastDeckW) changed = true;
        lastDeckW = w;
      } else {
        const h = Math.round(e.contentRect.height);
        if (sizes.has(e.target) && sizes.get(e.target) !== h) changed = true;
        sizes.set(e.target, h);
      }
    }
    if (changed) later(60);
  });
  ro.observe(deck);
  ro.observe(bar);
  if (notice) ro.observe(notice);
  document.addEventListener('layoutchange', () => later(60));
  // Islands (MarkComplete) change size when they hydrate or celebrate: re-page their slide.
  const islandWatch = new MutationObserver(() => later(150));
  article.querySelectorAll(':scope > astro-island').forEach((isl) => islandWatch.observe(isl, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ready', 'class'] }));

  const enterSlides = (initial: boolean) => {
    root.dataset.lessonView = 'slides';
    if (notice) bar.after(notice);
    dockTitle(true);
    controls.hidden = false;
    article.querySelectorAll<HTMLImageElement>('img[loading="lazy"]').forEach((img) => (img.loading = 'eager')); // hidden lazy images would never load
    groups ??= build();
    if (!groups.length) return enterFull(false);
    slides = [];
    index = 0;
    repaginate();
    const fromUrl = fromHash(location.hash);
    go(fromUrl ?? 0, { focus: !initial, scroll: true, replace: !initial });
    root.dataset.deckReady = 'true';
  };

  const enterFull = (keepPlace: boolean) => {
    const anchor = slides[index];
    root.dataset.lessonView = 'full';
    controls.hidden = true;
    if (notice) noticeHome.after(notice);
    dockTitle(false);
    managed.forEach((n) => n.classList.remove('slide-off'));
    zoomed.forEach((el) => el.style.removeProperty('zoom'));
    zoomed.clear();
    shownGroup = null;
    article.style.removeProperty('height');
    article.classList.remove('slide-scroll');
    delete article.dataset.slideSection;
    delete article.dataset.slideIndex;
    root.dataset.deckReady = 'true';
    document.dispatchEvent(new CustomEvent('slidechange', { detail: null }));
    markScrollable();
    if (keepPlace && anchor) {
      const target = anchor.leaves[0] ?? anchor.group.main ?? anchor.group.header;
      if (parseSlideHash(location.hash) !== null) history.replaceState(history.state, '', anchor.group.main ? `#${anchor.group.id}` : location.pathname);
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    }
  };

  const setView = (v: LessonView) => {
    if (v === view) return;
    view = v;
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* private mode: the choice lasts for this page only */
    }
    setButtons();
    if (v === 'slides') enterSlides(false);
    else enterFull(true);
  };

  // ---------- events ----------
  viewBtns.forEach((b) => b.addEventListener('click', () => setView(b.dataset.view === 'full' ? 'full' : 'slides')));
  prevBtn.addEventListener('click', () => go(index - 1));
  nextBtn.addEventListener('click', () => go(index + 1));

  document.addEventListener('keydown', (e) => {
    if (view !== 'slides' || e.defaultPrevented) return;
    const a = keyAction(e);
    if (!a) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest('input, textarea, select, [contenteditable="true"], .quiz, table, pre')) return; // those use arrows themselves
    e.preventDefault();
    go(index + (a === 'next' ? 1 : -1));
  });

  let touch: { x: number; y: number; t: number } | null = null;
  article.addEventListener(
    'touchstart',
    (e) => {
      const t = e.target as HTMLElement;
      touch = view === 'slides' && e.touches.length === 1 && !t.closest('table, pre, .quiz, .console') ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
    },
    { passive: true },
  );
  article.addEventListener(
    'touchend',
    (e) => {
      if (!touch || Date.now() - touch.t > 1000) return;
      const p = e.changedTouches[0];
      const a = swipeAction(p.clientX - touch.x, p.clientY - touch.y);
      touch = null;
      if (a) go(index + (a === 'next' ? 1 : -1));
    },
    { passive: true },
  );

  window.addEventListener('hashchange', () => {
    if (view !== 'slides') return;
    const i = fromHash(location.hash);
    if (i !== null) go(i);
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = (ms = 120) => {
    if (view !== 'slides' || paging) return;
    clearTimeout(timer);
    timer = setTimeout(() => view === 'slides' && repaginate(), ms);
  };
  let lastW = window.innerWidth;
  let lastH = window.innerHeight;
  window.addEventListener('resize', () => {
    // Mobile URL-bar show/hide changes the height by a few dozen px: only re-page on a real change.
    if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 90) return;
    lastW = window.innerWidth;
    lastH = window.innerHeight;
    later(150);
  });
  article.querySelectorAll('img').forEach((img) => img.addEventListener('load', () => later(), { once: true }));
  article.querySelectorAll<HTMLDetailsElement>('details.deep-dive').forEach((d) =>
    d.addEventListener('toggle', () => {
      if (view !== 'slides' || paging || !groups) return;
      const g = groups.find((x) => x.deep === d);
      repaginate();
      const first = slides.findIndex((s) => s.group === g);
      if (first >= 0) go(first, { focus: false, scroll: true, replace: true });
    }),
  );
  window.addEventListener('beforeprint', () => view === 'slides' && managed.forEach((n) => n.classList.remove('slide-off')));
  window.addEventListener('afterprint', () => {
    if (view !== 'slides') return;
    shownGroup = null;
    go(index, { focus: false, scroll: false, replace: false });
  });

  // Wide tables / code blocks that scroll sideways must be keyboard-focusable (WCAG 2.1.1). Re-checked
  // whenever what is on screen changes: a slide change, the view switch, or the web font arriving.
  function markScrollable() {
    article.querySelectorAll<HTMLElement>('table, pre').forEach((el) => {
      if (el.getClientRects().length && el.scrollWidth > el.clientWidth + 1) el.tabIndex = 0;
      else if (el.getClientRects().length) el.removeAttribute('tabindex');
    });
  }
  document.fonts?.addEventListener('loadingdone', () => markScrollable());
  window.addEventListener('load', () => markScrollable());

  setButtons();
  bar.hidden = false;
  if (view === 'slides') {
    // Page once the web font and the diagrams are in (bounded wait) so slide numbers are stable from the start.
    const imgs = [...article.querySelectorAll<HTMLImageElement>('img')];
    imgs.forEach((img) => (img.loading = 'eager')); // hidden lazy images would never load
    const loaded = imgs.map(
      (img) =>
        new Promise<void>((done) => {
          if (img.complete) return done();
          img.addEventListener('load', () => done(), { once: true });
          img.addEventListener('error', () => done(), { once: true });
        }),
    );
    // fonts.ready alone resolves before a lazily-used web font has even started loading: ask for the faces.
    const fonts = document.fonts ? Promise.all(['400', '500', '600', '700'].map((w) => document.fonts.load(`${w} 20px Poppins`).catch(() => []))) : Promise.resolve();
    document.fonts?.addEventListener('loadingdone', () => later());
    Promise.race([Promise.all([fonts, ...loaded]), new Promise((r) => setTimeout(r, 1500))]).then(() => {
      if (view === 'slides') enterSlides(true);
    });
  } else enterFull(false);
}
