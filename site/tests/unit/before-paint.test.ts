import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setBootstrap, USER } from './client-helpers';

// T189 CL3 — the before-paint scripts read #aip-bootstrap (signed in) or the aip-ui:* fallback (signed out).
const run = (file: string) => new Function(readFileSync(resolve(process.cwd(), 'public/scripts', file), 'utf8'))();
const html = document.documentElement;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  for (const k of ['theme', 'sidebar', 'sections', 'auth', 'lessonView', 'deckReady']) delete html.dataset[k];
});
afterEach(() => {
  vi.useRealTimers();
  setBootstrap(null);
});

describe('ui-prefs.js', () => {
  it('signed in: theme from progress.settings, bars from UiState, data-auth="in"; localStorage ignored', () => {
    localStorage.setItem('aip-ui:sections', 'collapsed');
    setBootstrap({ user: USER, progress: { settings: { theme: 'dark' } }, ui: { sidebar: 'collapsed', sections: 'expanded' } });
    run('ui-prefs.js');
    expect(html.dataset.auth).toBe('in');
    expect(html.dataset.theme).toBe('dark');
    expect(html.dataset.sidebar).toBe('collapsed');
    expect(html.dataset.sections).toBeUndefined();
  });
  it('signed in: a pagehide hand-off from the previous page wins over a stale bootstrap', () => {
    sessionStorage.setItem('aip-handoff:ui:7', JSON.stringify({ sidebar: 'collapsed' }));
    sessionStorage.setItem('aip-handoff:progress:7', JSON.stringify({ settings: { theme: 'dark' } }));
    setBootstrap({ user: USER, progress: { settings: {} }, ui: {} });
    run('ui-prefs.js');
    expect(html.dataset.sidebar).toBe('collapsed');
    expect(html.dataset.theme).toBe('dark');
    sessionStorage.setItem('aip-handoff:ui:7', JSON.stringify({ lessonView: 'full' }));
    run('lesson-view.js');
    expect(html.dataset.lessonView).toBe('full');
  });
  it('signed out: data-auth="out" and the localStorage fallback', () => {
    localStorage.setItem('aip-ui:sections', 'collapsed');
    localStorage.setItem('aip-ui:theme', 'dark');
    setBootstrap({ user: null, progress: null, ui: null });
    run('ui-prefs.js');
    expect(html.dataset.auth).toBe('out');
    expect(html.dataset.theme).toBe('dark');
    expect(html.dataset.sections).toBe('collapsed');
    expect(html.dataset.sidebar).toBeUndefined();
  });
  it('no bootstrap at all (static preview) = signed out; garbage JSON never throws', () => {
    run('ui-prefs.js');
    expect(html.dataset.auth).toBe('out');
    setBootstrap('{oops');
    expect(() => run('ui-prefs.js')).not.toThrow();
    expect(html.dataset.auth).toBe('out');
  });
});

describe('lesson-view.js', () => {
  it('signed in: UiState.lessonView', () => {
    localStorage.setItem('aip-ui:lesson-view', 'full');
    setBootstrap({ user: USER, progress: null, ui: { lessonView: 'slides' } });
    run('lesson-view.js');
    expect(html.dataset.lessonView).toBe('slides');
    setBootstrap({ user: USER, progress: null, ui: { lessonView: 'full' } });
    run('lesson-view.js');
    expect(html.dataset.lessonView).toBe('full');
  });
  it('signed out: aip-ui:lesson-view, default slides', () => {
    run('lesson-view.js');
    expect(html.dataset.lessonView).toBe('slides');
    localStorage.setItem('aip-ui:lesson-view', 'full');
    run('lesson-view.js');
    expect(html.dataset.lessonView).toBe('full');
  });
  it('falls back to the full page if the deck never starts', () => {
    run('lesson-view.js');
    vi.advanceTimersByTime(6000);
    expect(html.dataset.lessonView).toBe('full');
  });
});
