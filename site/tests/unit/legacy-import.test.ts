import { beforeEach, describe, expect, it } from 'vitest';
import { findLegacyProgress, legacyImportOffer, readImportDecision, rememberImportDecision } from '../../src/lib/progress/legacy';
import { createMemoryStore, defaultProgress } from '../../src/lib/progress/store';

// T189 CL1 — legacy localStorage progress (pre-account) is detected for the one-time import offer.
const withDays = (n: number) => {
  const p = defaultProgress();
  for (let d = 1; d <= n; d++) p.days[String(d)] = { status: 'completed', sectionsViewed: ['recap'], completedAt: '2026-10-02T00:00:00.000Z' };
  return JSON.stringify(p);
};

describe('legacy import detection', () => {
  beforeEach(() => localStorage.clear());

  it('finds aip-course:v1 and profile keys, skips backups, empty, invalid and unrelated keys', () => {
    localStorage.setItem('aip-course:v1', withDays(2));
    localStorage.setItem('aip-course:v1:p:p-abc123', withDays(5));
    localStorage.setItem('aip-course:v1:p:p-abc123:backup', '{bad');
    localStorage.setItem('aip-course:v1:p:p-empty1', JSON.stringify(defaultProgress()));
    localStorage.setItem('aip-course:v1:p:p-broken', '{"schemaVersion":1}');
    localStorage.setItem('aip-ui:sidebar', 'collapsed');
    localStorage.setItem('aip-profiles:v1', JSON.stringify({ active: 'p-abc123', profiles: [{ id: 'default', name: 'Learner' }, { id: 'p-abc123', name: 'Sam' }] }));
    const found = findLegacyProgress(localStorage);
    expect(found.map((f) => f.key)).toEqual(['aip-course:v1', 'aip-course:v1:p:p-abc123']);
    expect(found.map((f) => f.name)).toEqual(['Learner', 'Sam']);
    expect(found[1].pending.summary.daysCompleted).toBe(5);
  });

  it('offered only when signed in and not yet decided; the decision is remembered', () => {
    localStorage.setItem('aip-course:v1', withDays(1));
    expect(legacyImportOffer(localStorage, false)).toEqual([]);
    expect(legacyImportOffer(localStorage, true)).toHaveLength(1);
    rememberImportDecision(localStorage, 'declined');
    expect(readImportDecision(localStorage)).toBe('declined');
    expect(legacyImportOffer(localStorage, true)).toEqual([]);
  });

  it('nothing to offer on a clean browser or without storage', () => {
    expect(legacyImportOffer(localStorage, true)).toEqual([]);
    expect(findLegacyProgress(null)).toEqual([]);
  });

  it('confirm replaces the account store with the legacy progress (io.ts validation)', () => {
    localStorage.setItem('aip-course:v1', withDays(3));
    const [offer] = findLegacyProgress(localStorage);
    const store = createMemoryStore();
    offer.pending.confirm(store);
    expect(Object.values(store.get().days).filter((d) => d.status === 'completed')).toHaveLength(3);
  });
});
