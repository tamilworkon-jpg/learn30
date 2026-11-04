import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentCourseId } from '../../src/lib/current-course';
import { localProgressKey } from '../../src/lib/progress/keys';
import { defaultProgress, getStore, loadStore, resetStoreSingleton } from '../../src/lib/progress/store';
import { resetSaveStatus } from '../../src/lib/save-status';
import { createUiState, getUiState, resetUiStateSingleton, UI_KEYS } from '../../src/lib/ui-state';
import { mockFetch, setBootstrap, USER } from './client-helpers';

// Learn30 W3 (spec 002 progress-api-v2): one store per course, course-scoped slide keys, theme in UiState.
const AWS = 'aws-ai-practitioner';
const DEMO = 'demo-course';
const prog = (days: number) => ({
  ...defaultProgress(),
  startedAt: '2026-10-01T00:00:00.000Z',
  days: Object.fromEntries(Array.from({ length: days }, (_, i) => [String(i + 1), { status: 'completed' as const, sectionsViewed: [] }])),
});

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  resetStoreSingleton();
  resetUiStateSingleton();
  resetSaveStatus();
  delete document.documentElement.dataset.course;
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setBootstrap(null);
  delete document.documentElement.dataset.course;
});

describe('current course', () => {
  it('<html data-course> wins, then the bootstrap course, else the first course', () => {
    setBootstrap({ user: USER, progress: null, ui: null, course: { id: DEMO, progress: null }, summary: null });
    expect(currentCourseId()).toBe(DEMO);
    document.documentElement.dataset.course = 'other-course';
    expect(currentCourseId()).toBe('other-course');
    delete document.documentElement.dataset.course;
    setBootstrap({ user: USER, progress: null, ui: null, course: null, summary: null });
    expect(currentCourseId()).toBe(AWS);
  });
});

describe('getStore(courseId)', () => {
  it('a course page: the store is that course and syncs to /api/courses/<id>/progress', async () => {
    const f = mockFetch();
    vi.stubGlobal('fetch', f.fn);
    setBootstrap({ user: USER, progress: prog(2), ui: null, course: { id: DEMO, progress: prog(2) }, summary: null });
    const s = getStore();
    expect(Object.keys(s.get().days)).toHaveLength(2);
    s.setRating('week-1', 5);
    await vi.advanceTimersByTimeAsync(400);
    expect(f.calls.map((c) => c.url)).toEqual([`/api/courses/${DEMO}/progress`]);
    expect(getStore(DEMO)).toBe(s);
    // Another course's progress is not on this page.
    expect(() => getStore(AWS)).toThrow(/loadStore/);
  });

  it('a global page carries the first course (older readers); other courses load from the server', async () => {
    const urls: string[] = [];
    const get = (async (url: string | URL | Request) => {
      urls.push(String(url));
      return new Response(JSON.stringify(prog(3)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    setBootstrap({ user: USER, progress: prog(1), ui: null, course: null, summary: { courses: {} } });
    expect(Object.keys(getStore().get().days)).toHaveLength(1);
    const demo = await loadStore(DEMO, get);
    expect(urls).toEqual([`/api/courses/${DEMO}/progress`]);
    expect(Object.keys(demo.get().days)).toHaveLength(3);
    expect(await loadStore(DEMO)).toBe(demo);
  });

  it('signed out: memory per course, nothing sent', () => {
    setBootstrap(null);
    const a = getStore(AWS);
    const b = getStore(DEMO);
    expect(a).not.toBe(b);
    a.setStartDate(new Date(2026, 0, 5));
    expect(b.get().startedAt).not.toBe(a.get().startedAt);
    expect(localStorage.length).toBe(0);
  });

  it('the account theme (UiState) overrides a theme stored in older progress', () => {
    setBootstrap({ user: USER, progress: { ...prog(0), settings: { theme: 'light' } }, ui: { theme: 'dark' }, course: null, summary: null });
    expect(getStore().get().settings.theme).toBe('dark');
  });

  it('local progress key per course', () => {
    expect(localProgressKey(DEMO)).toBe('aip-course:v2:demo-course');
  });
});

describe('UiState per course', () => {
  it('slides are keyed <course>:<day>; a bare pre-Learn30 key still reads as the first course', () => {
    const ui = createUiState({ signedIn: true, initial: { slides: { '4': { sectionId: 'quiz', block: 1 } } }, fetchImpl: mockFetch().fn });
    expect(ui.slide(4, AWS)).toEqual({ sectionId: 'quiz', block: 1 });
    expect(ui.slide(4, DEMO)).toBeNull();
    ui.setSlide(4, { sectionId: 'recap', block: 0 }, DEMO);
    ui.setSlide(4, { sectionId: 'summary', block: 2 }, AWS);
    expect(ui.get().slides).toEqual({ [`${DEMO}:4`]: { sectionId: 'recap', block: 0 }, [`${AWS}:4`]: { sectionId: 'summary', block: 2 } });
  });

  it('signed out: aip-ui:slide:<course>:<day>, falling back to the old aip-ui:slide:<day> for the first course', () => {
    localStorage.setItem('aip-ui:slide:3', JSON.stringify({ sectionId: 'explanation', block: 1 }));
    const ui = createUiState({ signedIn: false, storage: localStorage });
    expect(ui.slide(3, AWS)).toEqual({ sectionId: 'explanation', block: 1 });
    expect(ui.slide(3, DEMO)).toBeNull();
    ui.setSlide(2, { sectionId: 'quiz', block: 0 }, DEMO);
    expect(JSON.parse(localStorage.getItem(UI_KEYS.slide(2, DEMO))!)).toEqual({ sectionId: 'quiz', block: 0 });
    expect(UI_KEYS.slide(2, DEMO)).toBe('aip-ui:slide:demo-course:2');
  });

  it('the theme is an account-wide UI setting (signed out: aip-ui:theme)', async () => {
    const f = mockFetch();
    vi.stubGlobal('fetch', f.fn);
    setBootstrap({ user: USER, progress: null, ui: {}, course: null, summary: null });
    getUiState().setTheme('dark');
    await vi.advanceTimersByTimeAsync(400);
    expect(f.calls[0].body).toEqual({ theme: 'dark' });
    const out = createUiState({ signedIn: false, storage: localStorage });
    out.setTheme('dark');
    expect(localStorage.getItem('aip-ui:theme')).toBe('dark');
  });
});
