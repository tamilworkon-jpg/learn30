// T189 — browser side of the JSON API (contract §3–§4): CSRF headers on every call, and a debounced
// last-write-wins "save this document" syncer with retry/backoff and a keepalive flush on pagehide.

export const API_HEADERS = { 'Content-Type': 'application/json', 'X-AIP-Request': '1' } as const;

export interface ApiError {
  status: number;
  error: string;
  field?: string;
  retryAfter?: number;
}

type FetchFn = typeof fetch;
const realFetch: FetchFn = (...a) => fetch(...a);

/** fetch() with the CSRF header and JSON body; same-origin cookies are sent by default. */
export function apiFetch(path: string, init: { method?: string; body?: unknown; keepalive?: boolean } = {}, fetchImpl: FetchFn = realFetch) {
  return fetchImpl(path, {
    method: init.method ?? 'GET',
    headers: API_HEADERS,
    credentials: 'same-origin',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    keepalive: init.keepalive,
  });
}

const GENERIC = 'Something went wrong. Please try again.';

/** Call the API and return the parsed JSON body, or throw an ApiError with the server's {error, field}. */
export async function apiJson<T>(path: string, init: { method?: string; body?: unknown } = {}, fetchImpl: FetchFn = realFetch): Promise<T | null> {
  let res: Response;
  try {
    res = await apiFetch(path, init, fetchImpl);
  } catch {
    throw { status: 0, error: "Couldn't reach the server. Check your connection and try again." } satisfies ApiError;
  }
  const text = await res.text().catch(() => '');
  let data: Record<string, unknown> | null;
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const retry = Number(res.headers.get('Retry-After'));
    const err: ApiError = { status: res.status, error: typeof data?.error === 'string' ? data.error : GENERIC };
    if (typeof data?.field === 'string') err.field = data.field;
    if (Number.isFinite(retry) && retry > 0) err.retryAfter = retry;
    if (res.status === 429) err.error = rateLimitMessage(err.retryAfter);
    throw err;
  }
  return data as T | null;
}

export function rateLimitMessage(retryAfter?: number) {
  const mins = retryAfter ? Math.max(1, Math.ceil(retryAfter / 60)) : 15;
  return `Too many attempts. Please wait ${mins} minute${mins === 1 ? '' : 's'} and try again.`;
}

export const isApiError = (e: unknown): e is ApiError => !!e && typeof e === 'object' && typeof (e as ApiError).status === 'number' && typeof (e as ApiError).error === 'string';

// ---------- debounced document sync ----------

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'retrying' | 'failed';

export interface SyncOptions {
  url: string;
  body: () => unknown;
  delay?: number; // debounce, ms
  fetchImpl?: FetchFn;
  onStatus?: (s: SyncStatus) => void;
  /** Max backoff between retries, ms. */
  maxBackoff?: number;
  /**
   * Tab-local hand-off for the pagehide flush: the next page's GET can reach the server before the
   * keepalive PUT, so its bootstrap may be one change behind. The flushed document is also kept in
   * sessionStorage under `key`; the next page adopts it (see takeHandoff) and it is cleared after a
   * successful PUT.
   */
  handoff?: { storage: Storage | null; key: string };
}

/** The document a previous page in this tab flushed but may not have reached the server yet. */
export function takeHandoff(storage: Storage | null, key: string): unknown {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

function writeHandoff(h: SyncOptions['handoff'], json: string | null) {
  if (!h?.storage) return;
  try {
    if (json === null) h.storage.removeItem(h.key);
    else h.storage.setItem(h.key, json);
  } catch {
    /* storage blocked/full: the keepalive PUT alone has to do */
  }
}

export const SAVE_DEBOUNCE_MS = 400;
// Browsers cap the total keepalive body at 64 KiB; larger documents use a normal request.
const KEEPALIVE_LIMIT = 63 * 1024;

const retryable = (status: number) => status === 0 || status === 408 || status === 429 || status >= 500;

const live = new Set<{ settle: () => Promise<void> }>();
/** Send every pending change now and wait (before logging out, so nothing is lost or sent signed out). */
export async function settleAll() {
  await Promise.all([...live].map((s) => s.settle()));
}

export function createSync({ url, body, delay = SAVE_DEBOUNCE_MS, fetchImpl = realFetch, onStatus, maxBackoff = 30_000, handoff }: SyncOptions) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let dirty = false; // changes not yet sent
  let inflight = false;
  let failures = 0;
  let status: SyncStatus = 'idle';
  let current: Promise<void> | null = null;
  const set = (s: SyncStatus) => {
    if (s === status) return;
    status = s;
    onStatus?.(s);
  };
  const arm = (ms: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void run();
    }, ms);
  };

  const run = () => (current ??= send().finally(() => (current = null)));

  async function send() {
    if (!dirty || inflight) return;
    dirty = false;
    inflight = true;
    if (status !== 'retrying') set('saving');
    let code: number;
    try {
      const res = await apiFetch(url, { method: 'PUT', body: body() }, fetchImpl);
      code = res.status;
    } catch {
      code = 0; // offline / network error
    }
    inflight = false;
    if (code >= 200 && code < 300) {
      failures = 0;
      if (!dirty) writeHandoff(handoff, null);
      if (dirty) arm(delay);
      else set('saved');
      return;
    }
    dirty = true; // the server doesn't have this version yet
    if (!retryable(code)) {
      // 400/401/403/413: retrying the same document can't succeed; the next change tries again.
      failures = 0;
      set('failed');
      return;
    }
    failures++;
    set('retrying');
    arm(Math.min(maxBackoff, 1000 * 2 ** (failures - 1)));
  }

  const api = {
    /** A change happened: send it after the debounce (restarting the debounce). */
    schedule() {
      dirty = true;
      if (status === 'retrying') return arm(Math.min(delay, 1000)); // keep the indicator; try again soon
      arm(delay);
    },
    /** Page is going away: send now with keepalive so the request survives navigation. */
    flush() {
      if (!dirty) return;
      clearTimeout(timer);
      timer = undefined;
      dirty = false;
      const json = JSON.stringify(body());
      writeHandoff(handoff, json);
      void fetchImpl(url, { method: 'PUT', headers: API_HEADERS, credentials: 'same-origin', body: json, keepalive: new TextEncoder().encode(json).length <= KEEPALIVE_LIMIT }).catch(() => {});
    },
    get status() {
      return status;
    },
    /** true while a change is waiting to be sent (debounce, retry or request in flight). */
    get pending() {
      return dirty || inflight;
    },
    /** Send a pending change now (no keepalive) and wait for it; one attempt, no retry loop. */
    async settle() {
      if (current) await current;
      if (!dirty) return;
      clearTimeout(timer);
      timer = undefined;
      await run();
      clearTimeout(timer); // don't keep retrying after an explicit settle (e.g. logging out)
      timer = undefined;
    },
  };
  live.add(api);
  return api;
}

export type Sync = ReturnType<typeof createSync>;
