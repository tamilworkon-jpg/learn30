import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUiState, getUiState, readLocalTheme, resetUiStateSingleton, sanitizeUiState, writeLocalTheme } from '../../src/lib/ui-state';
import { mockFetch, setBootstrap, USER } from './client-helpers';

// T189 CL1 — UiState: read from the bootstrap, debounced PUT /api/ui; signed out → localStorage fallback.
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  resetUiStateSingleton();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setBootstrap(null);
});

describe('signed in', () => {
  it('reads lessonView / sidebar / sections / slides from the bootstrap', () => {
    setBootstrap({ user: USER, progress: null, ui: { lessonView: 'full', sidebar: 'collapsed', slides: { '3': { sectionId: 'explanation', block: 2 } } } });
    const ui = getUiState();
    expect(ui.signedIn).toBe(true);
    expect(ui.lessonView()).toBe('full');
    expect(ui.collapsed('sidebar')).toBe(true);
    expect(ui.collapsed('sections')).toBe(false);
    expect(ui.slide(3)).toEqual({ sectionId: 'explanation', block: 2 });
    expect(ui.slide(4)).toBeNull();
  });

  it('changes are ONE debounced PUT /api/ui with the whole document and CSRF headers; nothing in localStorage', async () => {
    const f = mockFetch();
    const ui = createUiState({ signedIn: true, initial: { sidebar: 'collapsed' }, fetchImpl: f.fn });
    ui.setLessonView('full');
    ui.setCollapsed('sections', true);
    ui.setSlide(5, { sectionId: 'recap', block: 0 });
    ui.setSlide(5, { sectionId: 'objectives', block: 1 });
    await vi.advanceTimersByTimeAsync(399);
    expect(f.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].url).toBe('/api/ui');
    expect(f.calls[0].init.method).toBe('PUT');
    expect(f.calls[0].init.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-AIP-Request': '1' });
    expect(f.calls[0].body).toEqual({ sidebar: 'collapsed', lessonView: 'full', sections: 'collapsed', slides: { '5': { sectionId: 'objectives', block: 1 } } });
    expect(localStorage.length).toBe(0);
  });

  it('an unchanged slide position sends nothing', async () => {
    const f = mockFetch();
    const ui = createUiState({ signedIn: true, initial: { slides: { '2': { sectionId: 'recap', block: 0 } } }, fetchImpl: f.fn });
    ui.setSlide(2, { sectionId: 'recap', block: 0 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.calls).toHaveLength(0);
  });

  it('pagehide flushes with keepalive', () => {
    const f = mockFetch();
    vi.stubGlobal('fetch', f.fn);
    setBootstrap({ user: USER, progress: null, ui: null });
    getUiState().setCollapsed('sidebar', true);
    window.dispatchEvent(new Event('pagehide'));
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].init.keepalive).toBe(true);
    expect(f.calls[0].body).toEqual({ sidebar: 'collapsed' });
  });

  it('adopts a pagehide hand-off from the previous page and re-sends it', async () => {
    const f = mockFetch();
    const handoff = { storage: sessionStorage, key: 'aip-handoff:ui:7' };
    const a = createUiState({ signedIn: true, initial: {}, fetchImpl: f.fn, handoff });
    a.setSlide(2, { sectionId: 'recap', block: 1 });
    a.sync!.flush();
    const b = createUiState({ signedIn: true, initial: {}, fetchImpl: f.fn, handoff });
    expect(b.slide(2)).toEqual({ sectionId: 'recap', block: 1 });
    await vi.advanceTimersByTimeAsync(400);
    expect(f.calls).toHaveLength(2);
    expect(sessionStorage.getItem(handoff.key)).toBeNull();
  });

  it('rejects invalid days / positions', () => {
    const ui = createUiState({ signedIn: true, fetchImpl: mockFetch().fn });
    ui.setSlide(31, { sectionId: 'x', block: 0 });
    ui.setSlide(0, { sectionId: 'x', block: 0 });
    ui.setSlide(3, { sectionId: 'x', block: -1 });
    expect(ui.get()).toEqual({});
  });
});

describe('signed out', () => {
  it('falls back to the per-browser aip-ui:* keys and never calls the API', async () => {
    const f = mockFetch();
    vi.stubGlobal('fetch', f.fn);
    localStorage.setItem('aip-ui:lesson-view', 'full');
    localStorage.setItem('aip-ui:sections', 'collapsed');
    setBootstrap({ user: null, progress: null, ui: null });
    const ui = getUiState();
    expect(ui.signedIn).toBe(false);
    expect(ui.lessonView()).toBe('full');
    expect(ui.collapsed('sections')).toBe(true);
    ui.setLessonView('slides');
    ui.setCollapsed('sidebar', true);
    ui.setCollapsed('sections', false);
    ui.setSlide(4, { sectionId: 'quiz', block: 0 });
    expect(localStorage.getItem('aip-ui:lesson-view')).toBe('slides');
    expect(localStorage.getItem('aip-ui:sidebar')).toBe('collapsed');
    expect(localStorage.getItem('aip-ui:sections')).toBeNull();
    expect(JSON.parse(localStorage.getItem('aip-ui:slide:4')!)).toEqual({ sectionId: 'quiz', block: 0 });
    expect(createUiState({ signedIn: false, storage: localStorage }).slide(4)).toEqual({ sectionId: 'quiz', block: 0 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(f.calls).toHaveLength(0);
  });

  it('signed out with no storage works in memory', () => {
    const ui = createUiState({ signedIn: false, storage: null });
    ui.setLessonView('full');
    expect(ui.lessonView()).toBe('full');
  });

  it('theme fallback', () => {
    expect(readLocalTheme()).toBe('light');
    writeLocalTheme('dark');
    expect(localStorage.getItem('aip-ui:theme')).toBe('dark');
    expect(readLocalTheme()).toBe('dark');
    writeLocalTheme('light');
    expect(localStorage.getItem('aip-ui:theme')).toBeNull();
  });
});

describe('sanitizeUiState', () => {
  it('keeps only the contract shape', () => {
    expect(sanitizeUiState({ lessonView: 'grid', sidebar: 'collapsed', extra: 1, slides: { '2': { sectionId: 'a', block: 1 }, '40': { sectionId: 'b', block: 0 }, '3': { sectionId: 5, block: 0 } } })).toEqual({
      sidebar: 'collapsed',
      slides: { '2': { sectionId: 'a', block: 1 } },
    });
    expect(sanitizeUiState(null)).toEqual({});
  });
});
