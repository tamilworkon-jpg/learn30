// Storage keys for progress and local profiles (T184). Kept dependency-free so store.ts and profiles.ts
// can both use it, and BaseLayout's inline theme script mirrors the same rules.
export const STORAGE_KEY = 'aip-course:v1';
export const PROFILES_KEY = 'aip-profiles:v1';
export const DEFAULT_PROFILE_ID = 'default';

/** The default profile keeps the original single-user key, so existing progress needs no migration. */
export const progressKey = (profileId: string) => (profileId === DEFAULT_PROFILE_ID ? STORAGE_KEY : `${STORAGE_KEY}:p:${profileId}`);

/** Active profile id from the index, falling back to the default profile on any problem. */
export function readActiveProfileId(storage: Storage | null): string {
  try {
    const raw = storage?.getItem(PROFILES_KEY);
    if (!raw) return DEFAULT_PROFILE_ID;
    const idx = JSON.parse(raw) as { active?: unknown; profiles?: unknown };
    if (typeof idx.active === 'string' && Array.isArray(idx.profiles) && idx.profiles.some((p) => p && (p as { id?: unknown }).id === idx.active)) return idx.active;
  } catch {
    /* fall through */
  }
  return DEFAULT_PROFILE_ID;
}
