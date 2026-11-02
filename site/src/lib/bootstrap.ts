// T189 — per-page bootstrap written by the Node server immediately before </head> (contract §5):
// <script type="application/json" id="aip-bootstrap">{"user":…|null,"progress":…|null,"ui":…|null}</script>
// Never executed (CSP-safe); read once per page. Missing / unreadable → signed out.
import type { Progress } from './types';

export interface User {
  id: number;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface UiState {
  lessonView?: 'slides' | 'full';
  sidebar?: 'expanded' | 'collapsed';
  sections?: 'expanded' | 'collapsed';
  slides?: Record<string, { sectionId: string; block: number }>;
}

export interface Bootstrap {
  user: User | null;
  progress: Progress | null;
  ui: UiState | null;
}

export const BOOTSTRAP_ID = 'aip-bootstrap';
const SIGNED_OUT: Bootstrap = { user: null, progress: null, ui: null };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const isUser = (u: unknown): u is User => isObj(u) && typeof u.id === 'number' && typeof u.username === 'string' && typeof u.displayName === 'string';

export function parseBootstrap(doc: Document = document): Bootstrap {
  const el = doc.getElementById(BOOTSTRAP_ID);
  if (!el || el.getAttribute('type') !== 'application/json') return { ...SIGNED_OUT };
  try {
    const data = JSON.parse(el.textContent ?? '') as unknown;
    if (!isObj(data) || !isUser(data.user)) return { ...SIGNED_OUT };
    return {
      user: data.user,
      progress: isObj(data.progress) ? (data.progress as unknown as Progress) : null,
      ui: isObj(data.ui) ? (data.ui as UiState) : null,
    };
  } catch {
    return { ...SIGNED_OUT };
  }
}

let cached: Bootstrap | null = null;
/** The page's bootstrap (parsed once). Outside a browser → signed out. */
export function getBootstrap(): Bootstrap {
  if (typeof document === 'undefined') return { ...SIGNED_OUT };
  return (cached ??= parseBootstrap(document));
}
export const currentUser = () => getBootstrap().user;
export const isSignedIn = () => currentUser() !== null;

/** Test hook: forget the cached bootstrap. */
export function resetBootstrapCache() {
  cached = null;
}
