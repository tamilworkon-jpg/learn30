import { describe, expect, it, vi } from 'vitest';
import { apiJson, createSync, rateLimitMessage } from '../../src/lib/api';
import { initials, loginHref, logout, nextFromLocation, safeNext, validateDisplayName, validatePassword, validateUsername } from '../../src/lib/auth';

// T189 — sign-in helpers: `next` is honoured only for same-site relative paths.
describe('safeNext', () => {
  it.each([
    ['/day/3', '/day/3'],
    ['/day/3?x=1#slide-2', '/day/3?x=1#slide-2'],
    ['/settings', '/settings'],
  ])('accepts %s', (raw, out) => expect(safeNext(raw)).toBe(out));
  it.each(['//evil.example', 'https://evil.example/', 'http:/x', 'javascript:alert(1)', '/\\evil.example', '\\\\evil', 'day/3', '', '/login', '/signup/', '/x\n/y'])('rejects %j', (raw) =>
    expect(safeNext(raw)).toBe('/'),
  );
  it('null / missing → fallback', () => {
    expect(safeNext(null)).toBe('/');
    expect(nextFromLocation('?next=%2F%2Fevil.example')).toBe('/');
    expect(nextFromLocation('?next=%2Fday%2F4')).toBe('/day/4');
    expect(nextFromLocation('')).toBe('/');
  });
  it('loginHref carries the current path', () => {
    expect(loginHref('/day/3')).toBe('/login?next=%2Fday%2F3');
    expect(loginHref('/')).toBe('/login');
    expect(loginHref('//evil')).toBe('/login');
  });
});

describe('validation', () => {
  it('username / password / display name', () => {
    expect(validateUsername('Sam_Lee.1')).toBeNull();
    expect(validateUsername('ab')).toMatch(/3–30/);
    expect(validateUsername('sam lee')).toMatch(/letters/);
    expect(validateUsername('')).toMatch(/Enter/);
    expect(validatePassword('1234567')).toMatch(/8/);
    expect(validatePassword('12345678')).toBeNull();
    expect(validatePassword('x'.repeat(129))).toMatch(/128/);
    expect(validateDisplayName('x'.repeat(31))).toMatch(/30/);
    expect(initials('  sam   lee ')).toBe('SL');
    expect(initials('')).toBe('?');
  });
});

describe('apiJson', () => {
  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    vi.fn(async () => new Response(body === null ? null : JSON.stringify(body), { status, headers })) as unknown as typeof fetch;

  it('sends JSON with the CSRF header and returns the body', async () => {
    const f = respond(200, { user: { id: 1 } });
    await expect(apiJson('/api/auth/login', { method: 'POST', body: { username: 'a', password: 'b' } }, f)).resolves.toEqual({ user: { id: 1 } });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-AIP-Request': '1' });
    expect(JSON.parse(init.body as string)).toEqual({ username: 'a', password: 'b' });
  });
  it('surfaces { error, field } from the API', async () => {
    await expect(apiJson('/api/auth/signup', { method: 'POST', body: {} }, respond(400, { error: 'Username is too short.', field: 'username' }))).rejects.toEqual({
      status: 400,
      error: 'Username is too short.',
      field: 'username',
    });
  });
  it('429 → a friendly wait message using Retry-After', async () => {
    await expect(apiJson('/api/auth/login', { method: 'POST', body: {} }, respond(429, { error: 'Too many' }, { 'Retry-After': '120' }))).rejects.toMatchObject({
      status: 429,
      error: 'Too many attempts. Please wait 2 minutes and try again.',
    });
    expect(rateLimitMessage()).toMatch(/15 minutes/);
  });
  it('network failure → status 0', async () => {
    const f = vi.fn(async () => {
      throw new TypeError('offline');
    }) as unknown as typeof fetch;
    await expect(apiJson('/api/me', {}, f)).rejects.toMatchObject({ status: 0 });
  });
});

describe('logout', () => {
  it('sends pending saves first, then POST /api/auth/logout, then goes to /login', async () => {
    const order: string[] = [];
    const f = vi.fn(async (url: string, init: RequestInit) => {
      order.push(`${init.method} ${url}`);
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', f);
    const sync = createSync({ url: '/api/progress', body: () => ({ a: 1 }), fetchImpl: f });
    sync.schedule();
    const go = vi.fn();
    await logout(go);
    expect(order).toEqual(['PUT /api/progress', 'POST /api/auth/logout']);
    expect(go).toHaveBeenCalledWith('/login');
    vi.unstubAllGlobals();
  });
});
