// T184 — local learner profiles ("Who's learning?"): no server, no passwords. Each profile has its own
// progress document (incl. start date, theme, attempts) under its own localStorage key.
import { DEFAULT_PROFILE_ID, PROFILES_KEY, progressKey, readActiveProfileId } from './keys';
import { createStore } from './store';

export { DEFAULT_PROFILE_ID, PROFILES_KEY, progressKey };

export interface Profile {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}
export interface ProfileIndex {
  active: string;
  profiles: Profile[];
}

// Avatar colours (white text ≥ 4.5:1 on each).
export const PROFILE_COLORS = ['#503E9D', '#C2410C', '#1D4ED8', '#15803D', '#B91C1C', '#7E22CE', '#0F766E'];

const isProfile = (p: unknown): p is Profile =>
  !!p && typeof (p as Profile).id === 'string' && typeof (p as Profile).name === 'string' && typeof (p as Profile).color === 'string' && typeof (p as Profile).createdAt === 'string';

export function cleanName(raw: string): string {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 30) throw new Error('Name must be 1–30 characters.');
  return name;
}

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function createProfiles(storage: Storage | null = browserStorage()) {
  const fresh = (): ProfileIndex => ({
    active: DEFAULT_PROFILE_ID,
    profiles: [{ id: DEFAULT_PROFILE_ID, name: 'Learner', color: PROFILE_COLORS[0], createdAt: new Date().toISOString() }],
  });
  let index: ProfileIndex;
  try {
    const raw = storage?.getItem(PROFILES_KEY);
    const parsed = raw ? (JSON.parse(raw) as ProfileIndex) : null;
    const profiles = parsed && Array.isArray(parsed.profiles) ? parsed.profiles.filter(isProfile) : [];
    index = profiles.length ? { active: readActiveProfileId(storage), profiles } : fresh();
    if (!index.profiles.some((p) => p.id === index.active)) index.active = index.profiles[0].id;
  } catch {
    index = fresh();
  }

  const save = () => {
    try {
      storage?.setItem(PROFILES_KEY, JSON.stringify(index));
    } catch {
      /* storage blocked/full: profiles still work for this session */
    }
  };
  const find = (id: string) => {
    const p = index.profiles.find((x) => x.id === id);
    if (!p) throw new Error('Unknown profile');
    return p;
  };
  const assertUnique = (name: string, except?: string) => {
    if (index.profiles.some((p) => p.id !== except && p.name.toLowerCase() === name.toLowerCase())) throw new Error(`A learner called "${name}" already exists.`);
  };

  return {
    list: () => index.profiles,
    active: () => find(index.active),
    activeKey: () => progressKey(index.active),
    add(rawName: string): Profile {
      const name = cleanName(rawName);
      assertUnique(name);
      const id = `p-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
      const profile: Profile = { id, name, color: PROFILE_COLORS[index.profiles.length % PROFILE_COLORS.length], createdAt: new Date().toISOString() };
      index.profiles.push(profile);
      save();
      // Create the profile's progress now so its course start date is the day it was created.
      const s = createStore(storage, progressKey(id));
      s.replace(s.get());
      return profile;
    },
    rename(id: string, rawName: string) {
      const name = cleanName(rawName);
      assertUnique(name, id);
      find(id).name = name;
      save();
    },
    switchTo(id: string) {
      find(id);
      index.active = id;
      save();
    },
    remove(id: string) {
      find(id);
      if (index.profiles.length === 1) throw new Error('The last learner profile cannot be deleted.');
      index.profiles = index.profiles.filter((p) => p.id !== id);
      if (index.active === id) index.active = index.profiles[0].id;
      try {
        storage?.removeItem(progressKey(id));
        storage?.removeItem(`${progressKey(id)}:backup`);
      } catch {
        /* ignore */
      }
      save();
    },
  };
}

export type Profiles = ReturnType<typeof createProfiles>;
