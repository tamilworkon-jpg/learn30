// T189 — progress saved by older versions of the site in this browser's localStorage
// (`aip-course:v1`, or `aip-course:v1:p:<id>` per local profile). Offered once for import into the
// signed-in account; validation and the confirm step reuse io.ts.
import type { Progress } from '../types';
import { prepareImport, type ImportResult } from './io';
import { IMPORT_DECISION_KEY, LEGACY_PROFILE_PREFIX, LEGACY_PROFILES_KEY, STORAGE_KEY } from './keys';

export type PendingImport = Extract<ImportResult, { ok: true }>;

export interface LegacyProgress {
  key: string;
  /** Local profile name when the old profile index still knows it. */
  name: string | null;
  pending: PendingImport;
}

export type ImportDecision = 'imported' | 'declined';

const isLegacyKey = (k: string) => k === STORAGE_KEY || (k.startsWith(LEGACY_PROFILE_PREFIX) && !k.endsWith(':backup') && k.length > LEGACY_PROFILE_PREFIX.length);

/** Anything worth importing: a started lesson, an attempt or a resume position. */
function hasContent(p: Progress) {
  return p.attempts.length > 0 || p.lastPosition != null || Object.values(p.days).some((d) => d.status !== 'not-started' || d.sectionsViewed.length > 0);
}

function profileNames(storage: Storage): Map<string, string> {
  const names = new Map<string, string>();
  try {
    const idx = JSON.parse(storage.getItem(LEGACY_PROFILES_KEY) ?? 'null') as { profiles?: { id?: unknown; name?: unknown }[] } | null;
    for (const p of idx?.profiles ?? []) {
      if (typeof p?.id === 'string' && typeof p.name === 'string') names.set(p.id === 'default' ? STORAGE_KEY : LEGACY_PROFILE_PREFIX + p.id, p.name);
    }
  } catch {
    /* no names */
  }
  return names;
}

/** Valid, non-empty legacy progress documents in this browser (default key first). */
export function findLegacyProgress(storage: Storage | null): LegacyProgress[] {
  if (!storage) return [];
  const out: LegacyProgress[] = [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && isLegacyKey(k)) keys.push(k);
    }
    keys.sort((a, b) => (a === STORAGE_KEY ? -1 : b === STORAGE_KEY ? 1 : a.localeCompare(b)));
    const names = profileNames(storage);
    for (const key of keys) {
      const text = storage.getItem(key);
      if (!text) continue;
      const res = prepareImport(text);
      if (!res.ok || !hasContent(JSON.parse(text) as Progress)) continue;
      out.push({ key, name: names.get(key) ?? null, pending: res });
    }
  } catch {
    return out; // storage blocked
  }
  return out;
}

export function readImportDecision(storage: Storage | null): ImportDecision | null {
  try {
    const v = storage?.getItem(IMPORT_DECISION_KEY);
    return v === 'imported' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

export function rememberImportDecision(storage: Storage | null, decision: ImportDecision) {
  try {
    storage?.setItem(IMPORT_DECISION_KEY, decision);
  } catch {
    /* blocked: the offer may come back next visit */
  }
}

/** Offer only to a signed-in learner, once per browser, and only when there is something to import. */
export function legacyImportOffer(storage: Storage | null, signedIn: boolean): LegacyProgress[] {
  if (!signedIn || readImportDecision(storage) !== null) return [];
  return findLegacyProgress(storage);
}
