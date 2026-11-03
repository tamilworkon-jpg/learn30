// T189 — UI preferences (lesson view, collapsed side bars, saved slide position per day) as the
// account's UiState (contract §4): read from #aip-bootstrap, saved with a debounced PUT /api/ui.
// Signed out → the old per-browser localStorage keys (aip-ui:*), the only thing still stored locally.
import { createSync, takeHandoff, type Sync } from './api';
import { getBootstrap, type UiState } from './bootstrap';
import { reportSaveStatus } from './save-status';

export type { UiState };
export type LessonView = 'slides' | 'full';
export type Bar = 'sidebar' | 'sections';
export interface SlidePos {
  sectionId: string;
  block: number;
}

export const UI_KEYS = { lessonView: 'aip-ui:lesson-view', sidebar: 'aip-ui:sidebar', sections: 'aip-ui:sections', slide: (day: number) => `aip-ui:slide:${day}` } as const;

const validDay = (d: number | string) => /^([1-9]|[12]\d|30)$/.test(String(d));
const isPos = (v: unknown): v is SlidePos =>
  !!v && typeof v === 'object' && typeof (v as SlidePos).sectionId === 'string' && Number.isInteger((v as SlidePos).block) && (v as SlidePos).block >= 0;

/** Keep only what the server accepts (unknown keys are rejected there). */
export function sanitizeUiState(raw: unknown): UiState {
  const out: UiState = {};
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Record<string, unknown>;
  if (r.lessonView === 'slides' || r.lessonView === 'full') out.lessonView = r.lessonView;
  if (r.sidebar === 'expanded' || r.sidebar === 'collapsed') out.sidebar = r.sidebar;
  if (r.sections === 'expanded' || r.sections === 'collapsed') out.sections = r.sections;
  if (r.slides && typeof r.slides === 'object') {
    const slides: Record<string, SlidePos> = {};
    for (const [d, v] of Object.entries(r.slides as Record<string, unknown>)) if (validDay(d) && isPos(v)) slides[d] = { sectionId: v.sectionId, block: v.block };
    if (Object.keys(slides).length) out.slides = slides;
  }
  return out;
}

interface Options {
  signedIn: boolean;
  initial?: UiState | null;
  storage?: Storage | null;
  fetchImpl?: typeof fetch;
  delay?: number;
  /** Tab-local hand-off of a flushed document (see createSync). */
  handoff?: { storage: Storage | null; key: string };
}

export function createUiState({ signedIn, initial = null, storage = null, fetchImpl, delay, handoff }: Options) {
  const local = {
    get(k: string) {
      try {
        return storage?.getItem(k) ?? null;
      } catch {
        return null;
      }
    },
    set(k: string, v: string | null) {
      try {
        if (v === null) storage?.removeItem(k);
        else storage?.setItem(k, v);
      } catch {
        /* private mode: lasts for this page */
      }
    },
  };
  const handed = signedIn && handoff ? takeHandoff(handoff.storage, handoff.key) : null;
  let state: UiState = signedIn ? sanitizeUiState(handed ?? initial) : {};
  const sync: Sync | null = signedIn
    ? createSync({ url: '/api/ui', body: () => state, delay, fetchImpl, onStatus: (s) => reportSaveStatus('ui', s), handoff })
    : null;
  if (sync && handed) sync.schedule();
  const changed = () => sync?.schedule();

  if (!signedIn) {
    // Signed out: the per-browser fallback.
    if (local.get(UI_KEYS.lessonView) === 'full') state.lessonView = 'full';
    if (local.get(UI_KEYS.sidebar) === 'collapsed') state.sidebar = 'collapsed';
    if (local.get(UI_KEYS.sections) === 'collapsed') state.sections = 'collapsed';
  }

  return {
    signedIn,
    sync,
    get: (): UiState => state,
    lessonView: (): LessonView => (state.lessonView === 'full' ? 'full' : 'slides'),
    setLessonView(v: LessonView) {
      state = { ...state, lessonView: v };
      if (sync) changed();
      else local.set(UI_KEYS.lessonView, v);
    },
    collapsed: (bar: Bar) => state[bar] === 'collapsed',
    setCollapsed(bar: Bar, collapsed: boolean) {
      state = { ...state, [bar]: collapsed ? 'collapsed' : 'expanded' };
      if (sync) changed();
      else local.set(UI_KEYS[bar], collapsed ? 'collapsed' : 'expanded'); // explicit, so a narrow-screen default never overrides a choice
    },
    slide(day: number): SlidePos | null {
      if (!validDay(day)) return null;
      if (sync) return state.slides?.[String(day)] ?? null;
      try {
        const v = JSON.parse(local.get(UI_KEYS.slide(day)) ?? 'null') as unknown;
        return isPos(v) ? v : null;
      } catch {
        return null;
      }
    },
    setSlide(day: number, pos: SlidePos) {
      if (!validDay(day) || !isPos(pos)) return;
      const prev = state.slides?.[String(day)];
      if (prev && prev.sectionId === pos.sectionId && prev.block === pos.block) return;
      state = { ...state, slides: { ...state.slides, [String(day)]: { sectionId: pos.sectionId, block: pos.block } } };
      if (sync) changed();
      else local.set(UI_KEYS.slide(day), JSON.stringify({ sectionId: pos.sectionId, block: pos.block }));
    },
  };
}

export type UiStateStore = ReturnType<typeof createUiState>;

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

let singleton: UiStateStore | null = null;
export function getUiState(): UiStateStore {
  if (singleton) return singleton;
  const boot = getBootstrap();
  let session: Storage | null;
  try {
    session = typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    session = null;
  }
  singleton = createUiState({
    signedIn: boot.user !== null,
    initial: boot.ui,
    storage: boot.user ? null : browserStorage(),
    handoff: boot.user ? { storage: session, key: `aip-handoff:ui:${boot.user.id}` } : undefined,
  });
  const s = singleton.sync;
  if (s && typeof window !== 'undefined') window.addEventListener('pagehide', () => s.flush());
  return singleton;
}

/** Test hook. */
export function resetUiStateSingleton() {
  singleton = null;
}

/** Signed-out theme fallback (signed in, the theme lives in progress.settings). */
export const THEME_KEY = 'aip-ui:theme';
export function readLocalTheme(storage: Storage | null = browserStorage()): 'light' | 'dark' {
  try {
    return storage?.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
export function writeLocalTheme(theme: 'light' | 'dark', storage: Storage | null = browserStorage()) {
  try {
    if (theme === 'dark') storage?.setItem(THEME_KEY, 'dark');
    else storage?.removeItem(THEME_KEY);
  } catch {
    /* blocked */
  }
}
