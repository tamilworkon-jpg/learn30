// T189 — shared helpers for client unit tests: a fake #aip-bootstrap element and a recording fetch mock.
import { vi } from 'vitest';
import { resetBootstrapCache } from '../../src/lib/bootstrap';

export const USER = { id: 7, username: 'sam', displayName: 'Sam Lee', createdAt: '2026-11-01T10:00:00.000Z' };

export function setBootstrap(data: unknown | null) {
  document.getElementById('aip-bootstrap')?.remove();
  resetBootstrapCache();
  if (data === null) return;
  const el = document.createElement('script');
  el.type = 'application/json';
  el.id = 'aip-bootstrap';
  el.textContent = typeof data === 'string' ? data : JSON.stringify(data);
  document.head.append(el);
}

export interface Call {
  url: string;
  init: RequestInit;
  body: unknown;
}

/** fetch mock: `responses` are status codes (or 'network' for a rejected request), used in order; then 204. */
export function mockFetch(responses: (number | 'network')[] = []) {
  const calls: Call[] = [];
  const queue = [...responses];
  const fn = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init, body: typeof init.body === 'string' && init.body ? JSON.parse(init.body) : undefined });
    const r = queue.length ? queue.shift()! : 204;
    if (r === 'network') throw new TypeError('Failed to fetch');
    return new Response(r === 204 ? null : JSON.stringify({ error: 'x' }), { status: r });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}
