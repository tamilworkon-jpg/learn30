import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSync } from '../../src/lib/api';
import { getBootstrap, parseBootstrap } from '../../src/lib/bootstrap';
import { createMemoryStore, createSyncedStore, defaultProgress, getStore, resetStoreSingleton } from '../../src/lib/progress/store';
import { resetSaveStatus } from '../../src/lib/save-status';
import { mockFetch, setBootstrap, USER } from './client-helpers';

// T189 CL1 — the progress store on the server: #aip-bootstrap, ONE debounced PUT, keepalive flush,
// retry with backoff + "Couldn't save — retrying", signed out = memory only.
const progress = () => ({ ...defaultProgress(), startedAt: '2026-10-01T00:00:00.000Z', days: { '1': { status: 'completed' as const, sectionsViewed: ['recap'] } } });

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  resetStoreSingleton();
  resetSaveStatus();
  document.body.replaceChildren(Object.assign(document.createElement('p'), { className: 'save-status' }));
  document.querySelector('p')!.setAttribute('data-save-status', '');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setBootstrap(null);
});

describe('#aip-bootstrap', () => {
  it('signed in: user, progress and ui are read', () => {
    setBootstrap({ user: USER, progress: progress(), ui: { lessonView: 'full' } });
    const b = getBootstrap();
    expect(b.user).toEqual(USER);
    expect(b.progress?.startedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(b.ui).toEqual({ lessonView: 'full' });
  });
  it('missing, unreadable, or {user:null} → signed out', () => {
    setBootstrap(null);
    expect(parseBootstrap()).toEqual({ user: null, progress: null, ui: null, course: null, summary: null });
    setBootstrap('{"user":');
    expect(parseBootstrap().user).toBeNull();
    setBootstrap({ user: null, progress: null, ui: null });
    expect(parseBootstrap().user).toBeNull();
  });
  it('ignores an element that is not application/json', () => {
    setBootstrap({ user: USER, progress: null, ui: null });
    document.getElementById('aip-bootstrap')!.setAttribute('type', 'text/javascript');
    expect(parseBootstrap().user).toBeNull();
  });
});

describe('getStore()', () => {
  it('signed in: state comes from the bootstrap progress', () => {
    setBootstrap({ user: USER, progress: progress(), ui: null });
    const s = getStore();
    expect(s.signedIn).toBe(true);
    expect(s.persistent).toBe(true);
    expect(s.get().startedAt).toBe('2026-10-01T00:00:00.000Z');
    expect(s.get().days['1'].status).toBe('completed');
  });

  it('signed out: memory only — works, but nothing is written to localStorage or the network', () => {
    const f = mockFetch();
    vi.stubGlobal('fetch', f.fn);
    setBootstrap({ user: null, progress: null, ui: null });
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const s = getStore();
    expect(s.signedIn).toBe(false);
    expect(s.persistent).toBe(false);
    s.markSectionViewed(2, 'recap');
    s.markDayComplete(2);
    vi.advanceTimersByTime(5000);
    expect(s.get().days['2'].status).toBe('completed');
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(f.calls).toHaveLength(0);
    setItem.mockRestore();
  });

  it('signed in: pagehide flushes a pending change with keepalive', () => {
    const f = mockFetch();
    vi.stubGlobal('fetch', f.fn);
    setBootstrap({ user: USER, progress: progress(), ui: null });
    getStore().setRating('week-1', 4);
    window.dispatchEvent(new Event('pagehide'));
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].init.keepalive).toBe(true);
    expect(f.calls[0].init.method).toBe('PUT');
    expect((f.calls[0].body as { ratings: Record<string, number> }).ratings['week-1']).toBe(4);
    vi.advanceTimersByTime(1000);
    expect(f.calls).toHaveLength(1); // the debounced send was cancelled by the flush
  });

  it('an invalid bootstrap document starts fresh and reports recovered', () => {
    setBootstrap({ user: USER, progress: { nope: 1 }, ui: null });
    const s = getStore();
    expect(s.recovered).toBe(true);
    expect(s.get().days).toEqual({});
  });
});

describe('createSyncedStore', () => {
  it('mutations update memory synchronously and send ONE debounced PUT /api/progress with CSRF headers', async () => {
    const f = mockFetch();
    const { store } = createSyncedStore(progress(), { fetchImpl: f.fn });
    store.markSectionViewed(3, 'recap');
    expect(store.get().days['3'].sectionsViewed).toEqual(['recap']); // synchronous
    store.markSectionViewed(3, 'objectives');
    store.setLastPosition(3, 'objectives');
    vi.advanceTimersByTime(399);
    expect(f.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.calls).toHaveLength(1);
    const c = f.calls[0];
    expect(c.url).toBe('/api/courses/aws-ai-practitioner/progress'); // Learn30: per course (default: the first course)
    expect(c.init.method).toBe('PUT');
    expect(c.init.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-AIP-Request': '1' });
    expect(c.init.keepalive).toBeFalsy();
    expect((c.body as { days: Record<string, { sectionsViewed: string[] }> }).days['3'].sectionsViewed).toEqual(['recap', 'objectives']);
    await vi.advanceTimersByTimeAsync(5000);
    expect(f.calls).toHaveLength(1);
  });

  it('each change restarts the debounce', async () => {
    const f = mockFetch();
    const { store } = createSyncedStore(progress(), { fetchImpl: f.fn });
    for (let i = 0; i < 5; i++) {
      store.setRating('week-1', 1 + i);
      await vi.advanceTimersByTimeAsync(300);
    }
    expect(f.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(100);
    expect(f.calls).toHaveLength(1);
    expect((f.calls[0].body as { ratings: Record<string, number> }).ratings['week-1']).toBe(5);
  });

  it('a change during an in-flight PUT is sent afterwards (last write wins)', async () => {
    let release: () => void = () => {};
    const bodies: unknown[] = [];
    const fetchImpl = vi.fn((_u: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string));
      return bodies.length === 1 ? new Promise<Response>((r) => (release = () => r(new Response(null, { status: 204 })))) : Promise.resolve(new Response(null, { status: 204 }));
    }) as unknown as typeof fetch;
    const { store } = createSyncedStore(progress(), { fetchImpl });
    store.setRating('week-1', 2);
    await vi.advanceTimersByTimeAsync(400);
    store.setRating('week-1', 3);
    await vi.advanceTimersByTimeAsync(400);
    expect(bodies).toHaveLength(1);
    release();
    await vi.advanceTimersByTimeAsync(400);
    expect(bodies).toHaveLength(2);
    expect((bodies[1] as { ratings: Record<string, number> }).ratings['week-1']).toBe(3);
  });

  it('a failed PUT retries with backoff and shows a non-blocking "Couldn\'t save — retrying"', async () => {
    const f = mockFetch(['network', 503]);
    const { store, sync } = createSyncedStore(progress(), { fetchImpl: f.fn });
    const status = document.querySelector<HTMLElement>('[data-save-status]')!;
    store.markDayComplete(4);
    await vi.advanceTimersByTimeAsync(400);
    expect(f.calls).toHaveLength(1);
    expect(sync.status).toBe('retrying');
    expect(status.textContent).toBe('Couldn’t save — retrying');
    expect(status.dataset.state).toBe('retrying');
    await vi.advanceTimersByTimeAsync(999);
    expect(f.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); // 1 s backoff
    expect(f.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(f.calls).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1); // 2 s backoff
    expect(f.calls).toHaveLength(3);
    expect(sync.status).toBe('saved');
    expect(status.textContent).toBe('');
    expect(sync.pending).toBe(false);
  });

  it('a 400 is not retried (same document would fail again); the next change tries again', async () => {
    const f = mockFetch([400]);
    const { store, sync } = createSyncedStore(progress(), { fetchImpl: f.fn });
    store.setRating('week-2', 3);
    await vi.advanceTimersByTimeAsync(400);
    expect(sync.status).toBe('failed');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(f.calls).toHaveLength(1);
    store.setRating('week-2', 4);
    await vi.advanceTimersByTimeAsync(400);
    expect(f.calls).toHaveLength(2);
    expect(sync.status).toBe('saved');
  });

  it('backoff is capped', async () => {
    const f = mockFetch(Array(10).fill(500));
    const sync = createSync({ url: '/api/x', body: () => ({}), fetchImpl: f.fn, maxBackoff: 4000 });
    sync.schedule();
    await vi.advanceTimersByTimeAsync(400 + 1000 + 2000 + 4000 + 4000);
    expect(f.calls).toHaveLength(5);
  });

  it('settle() sends a pending change now and waits for it', async () => {
    const f = mockFetch();
    const { store, sync } = createSyncedStore(progress(), { fetchImpl: f.fn });
    store.setRating('week-3', 5);
    await sync.settle();
    expect(f.calls).toHaveLength(1);
    expect(sync.pending).toBe(false);
  });

  it('flush without changes sends nothing', () => {
    const f = mockFetch();
    const { sync } = createSyncedStore(progress(), { fetchImpl: f.fn });
    sync.flush();
    expect(f.calls).toHaveLength(0);
  });
});

describe('pagehide hand-off (next page may be requested before the keepalive PUT lands)', () => {
  const handoff = { storage: sessionStorage, key: 'aip-handoff:progress:7' };

  it('the flushed document is kept tab-locally and adopted by the next page, which re-sends it', async () => {
    const f = mockFetch();
    const a = createSyncedStore(progress(), { fetchImpl: f.fn, handoff });
    a.store.markDayComplete(9);
    a.sync.flush();
    expect(f.calls[0].init.keepalive).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(handoff.key)!).days['9'].status).toBe('completed');
    // next page: the server's bootstrap is stale (no day 9)
    const b = createSyncedStore(progress(), { fetchImpl: f.fn, handoff });
    expect(b.store.get().days['9'].status).toBe('completed');
    await vi.advanceTimersByTimeAsync(400);
    expect(f.calls).toHaveLength(2);
    expect(sessionStorage.getItem(handoff.key)).toBeNull(); // cleared after a successful PUT
    const c = createSyncedStore(progress(), { fetchImpl: f.fn, handoff });
    expect(c.store.get().days['9']).toBeUndefined();
  });

  it('an invalid hand-off is ignored', () => {
    sessionStorage.setItem(handoff.key, '{"nope":1}');
    const { store } = createSyncedStore(progress(), { fetchImpl: mockFetch().fn, handoff });
    expect(store.get().startedAt).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('createMemoryStore', () => {
  it('has the full synchronous API', () => {
    const s = createMemoryStore();
    s.setStartDate(new Date(2026, 0, 5));
    s.recordAttempt({ assessmentId: 'day-01', kind: 'daily', answers: {}, score: { correct: 1, total: 1, percent: 100, byDomain: {} }, durationSec: 5 } as never);
    expect(s.get().days['1'].bestScore).toBe(100);
    expect(new Date(s.get().startedAt).getDate()).toBe(5);
  });
});
