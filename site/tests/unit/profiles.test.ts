import { beforeEach, describe, expect, it } from 'vitest';
import { createProfiles, DEFAULT_PROFILE_ID, PROFILES_KEY, progressKey } from '../../src/lib/progress/profiles';
import { createStore, STORAGE_KEY } from '../../src/lib/progress/store';

// T184 PR1 — local profiles: index CRUD, per-profile storage keys, legacy key = default profile.
describe('local profiles (T184)', () => {
  beforeEach(() => localStorage.clear());

  it('PR1 first use: one default profile whose progress lives in the legacy key', () => {
    const p = createProfiles();
    expect(p.list()).toHaveLength(1);
    expect(p.active().id).toBe(DEFAULT_PROFILE_ID);
    expect(progressKey(DEFAULT_PROFILE_ID)).toBe(STORAGE_KEY);
    expect(p.activeKey()).toBe(STORAGE_KEY);
  });

  it('PR1 add / rename / switch keep separate storage keys and persist', () => {
    const p = createProfiles();
    const sam = p.add('  Sam  ');
    expect(sam.name).toBe('Sam');
    expect(sam.id).toMatch(/^p-[a-z0-9]{6,}$/);
    expect(progressKey(sam.id)).toBe(`${STORAGE_KEY}:p:${sam.id}`);
    p.rename(sam.id, 'Samira');
    p.switchTo(sam.id);
    const again = createProfiles();
    expect(again.active()).toMatchObject({ id: sam.id, name: 'Samira' });
    expect(again.list().map((x) => x.name)).toEqual(['Learner', 'Samira']);
    expect(JSON.parse(localStorage.getItem(PROFILES_KEY)!).active).toBe(sam.id);
  });

  it('PR1 a new profile starts its own course today (own startedAt)', () => {
    const p = createProfiles();
    const before = Date.now();
    const kim = p.add('Kim');
    const kimStore = createStore(localStorage, progressKey(kim.id));
    expect(Date.parse(kimStore.get().startedAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(localStorage.getItem(progressKey(kim.id))).not.toBeNull();
  });

  it('PR1 progress is separate per profile', () => {
    const p = createProfiles();
    const b = p.add('B');
    createStore(localStorage, progressKey(DEFAULT_PROFILE_ID)).markDayComplete(1);
    createStore(localStorage, progressKey(b.id)).markDayComplete(5);
    expect(createStore(localStorage, STORAGE_KEY).get().days['5']).toBeUndefined();
    expect(createStore(localStorage, progressKey(b.id)).get().days['1']).toBeUndefined();
  });

  it('PR1 delete removes only that profile and its data; the last profile cannot be deleted', () => {
    const p = createProfiles();
    const b = p.add('B');
    createStore(localStorage, progressKey(b.id)).markDayComplete(2);
    createStore(localStorage, STORAGE_KEY).markDayComplete(1);
    p.switchTo(b.id);
    p.remove(b.id);
    expect(localStorage.getItem(progressKey(b.id))).toBeNull();
    expect(p.active().id).toBe(DEFAULT_PROFILE_ID);
    expect(createStore(localStorage, STORAGE_KEY).get().days['1'].status).toBe('completed');
    expect(() => p.remove(DEFAULT_PROFILE_ID)).toThrow(/last/i);
  });

  it('names are validated (1–30 chars, trimmed, unique) and a corrupt index recovers', () => {
    const p = createProfiles();
    expect(() => p.add('   ')).toThrow();
    expect(() => p.add('x'.repeat(31))).toThrow();
    expect(() => p.add('learner')).toThrow(/already/i);
    localStorage.setItem(PROFILES_KEY, '{"active":"nope","profiles":"bad"}');
    expect(createProfiles().active().id).toBe(DEFAULT_PROFILE_ID);
  });
});
