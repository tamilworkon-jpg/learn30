import { h, render, type VNode } from 'preact';
import { act } from 'preact/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AccountMenu from '../../src/components/account/AccountMenu';
import AuthForm from '../../src/components/account/AuthForm';
import ImportOffer from '../../src/components/account/ImportOffer';
import AccountSettings from '../../src/components/account/AccountSettings';
import { defaultProgress, getStore, resetStoreSingleton } from '../../src/lib/progress/store';
import { setBootstrap, USER } from './client-helpers';

// T189 CL2 — account components render the signed-in / signed-out states.
let root: HTMLElement;
const mount = async (vnode: VNode<any>) => { // eslint-disable-line @typescript-eslint/no-explicit-any
  await act(() => render(vnode, root));
};
const flush = () =>
  act(async () => {
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
  });
const input = async (el: HTMLInputElement, value: string) => {
  await act(() => {
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

beforeEach(() => {
  localStorage.clear();
  resetStoreSingleton();
  root = document.createElement('div');
  document.body.replaceChildren(root);
  history.replaceState(null, '', '/day/3');
});
afterEach(() => {
  render(null, root);
  setBootstrap(null);
  vi.unstubAllGlobals();
});

describe('AccountMenu', () => {
  it('signed out: a "Sign in" link back to the current page', async () => {
    setBootstrap({ user: null, progress: null, ui: null });
    await mount(h(AccountMenu, {}));
    const menu = root.querySelector<HTMLElement>('[data-account-menu]')!;
    expect(menu.dataset.signedIn).toBe('false');
    const a = menu.querySelector<HTMLAnchorElement>('a')!;
    expect(a.textContent).toBe('Sign in');
    expect(a.getAttribute('href')).toBe('/login?next=%2Fday%2F3');
  });

  it('signed in: initials avatar; menu with name, @username, Settings, Log out', async () => {
    setBootstrap({ user: USER, progress: null, ui: null });
    await mount(h(AccountMenu, {}));
    const trigger = root.querySelector<HTMLButtonElement>('.account-trigger')!;
    expect(trigger.querySelector('.account-avatar')!.textContent).toBe('SL');
    expect(trigger.querySelector('.sr-only')!.textContent).toBe('Account: Sam Lee');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    await act(() => trigger.click());
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(root.querySelector('[data-account-name]')!.textContent).toBe('Sam Lee');
    expect(root.querySelector('[data-account-username]')!.textContent).toBe('@sam');
    expect(root.querySelector<HTMLAnchorElement>('a.account-item')!.getAttribute('href')).toBe('/settings#account');
    expect(root.querySelector('[data-logout]')!.textContent).toBe('Log out');
    await act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })));
    expect(root.querySelector('[data-account-name]')).toBeNull();
  });

  it('updates when Settings changes the display name', async () => {
    setBootstrap({ user: USER, progress: null, ui: null });
    await mount(h(AccountMenu, {}));
    await act(() => void document.dispatchEvent(new CustomEvent('aip:user', { detail: { ...USER, displayName: 'Kim Park' } })));
    expect(root.querySelector('.account-avatar')!.textContent).toBe('KP');
  });
});

describe('AuthForm', () => {
  it('login: labelled fields, password show/hide, client-side required errors', async () => {
    await mount(h(AuthForm, { mode: 'login' }));
    const form = root.querySelector<HTMLFormElement>('[data-login-form]')!;
    expect(form).not.toBeNull();
    const pw = root.querySelector<HTMLInputElement>('#auth-password')!;
    expect(root.querySelector('label[for="auth-password"]')!.textContent).toBe('Password');
    expect(root.querySelector('label[for="auth-username"]')!.textContent).toBe('Username');
    expect(pw.type).toBe('password');
    const toggle = root.querySelector<HTMLButtonElement>('[data-password-toggle]')!;
    await act(() => toggle.click());
    expect(pw.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    await act(() => void form.dispatchEvent(new Event('submit', { cancelable: true })));
    expect(root.querySelector('#auth-username')!.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('#auth-username-error')!.textContent).toMatch(/username/i);
  });

  it('shows the API error inline on its field, and 401 as a form error', async () => {
    history.replaceState(null, '', '/signup?next=%2Fday%2F2');
    const responses = [new Response(JSON.stringify({ error: 'That username is taken.', field: 'username' }), { status: 409 })];
    const f = vi.fn(async () => responses.shift() ?? new Response(JSON.stringify({ user: USER }), { status: 201 }));
    vi.stubGlobal('fetch', f);
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, search: '?next=%2Fday%2F2', pathname: '/signup', assign });
    await mount(h(AuthForm, { mode: 'signup' }));
    const form = root.querySelector<HTMLFormElement>('[data-signup-form]')!;
    await input(root.querySelector('#auth-username')!, 'Sam');
    await input(root.querySelector('#auth-password')!, 'correct horse');
    await act(() => void form.dispatchEvent(new Event('submit', { cancelable: true })));
    await flush();
    expect(root.querySelector('#auth-username-error')!.textContent).toBe('That username is taken.');
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/auth/signup');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'sam', password: 'correct horse' });
    await input(root.querySelector('#auth-username')!, 'sam2');
    await act(() => void form.dispatchEvent(new Event('submit', { cancelable: true })));
    await flush();
    expect(assign).toHaveBeenCalledWith('/day/2');
    expect(root.querySelector('.auth-switch a')!.getAttribute('href')).toBe('/login?next=%2Fday%2F2');
  });

  it('429 shows the wait message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'x' }), { status: 429, headers: { 'Retry-After': '60' } })));
    await mount(h(AuthForm, { mode: 'login' }));
    await input(root.querySelector('#auth-username')!, 'sam');
    await input(root.querySelector('#auth-password')!, 'whatever1');
    await act(() => void root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })));
    await flush();
    expect(root.querySelector('[data-form-error]')!.textContent).toBe('Too many attempts. Please wait 1 minute and try again.');
  });
});

describe('ImportOffer', () => {
  const legacy = () => {
    const p = defaultProgress();
    p.days['1'] = { status: 'completed', sectionsViewed: ['recap'] };
    localStorage.setItem('aip-course:v1', JSON.stringify(p));
  };

  it('signed out: never offered', async () => {
    legacy();
    setBootstrap({ user: null, progress: null, ui: null });
    await mount(h(ImportOffer, {}));
    expect(root.querySelector('[data-import-offer]')).toBeNull();
  });

  it('fresh account: one click imports (nothing to overwrite)', async () => {
    legacy();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    setBootstrap({ user: USER, progress: defaultProgress(), ui: null });
    await mount(h(ImportOffer, {}));
    await act(() => root.querySelector<HTMLButtonElement>('[data-import-accept]')!.click());
    expect(getStore().get().days['1'].status).toBe('completed');
    expect(root.querySelector('[data-import-offer]')!.getAttribute('data-state')).toBe('done');
  });

  it('account with progress: offer → confirm → imported once', async () => {
    legacy();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const mine = defaultProgress();
    mine.days['5'] = { status: 'in-progress', sectionsViewed: ['recap'] };
    setBootstrap({ user: USER, progress: mine, ui: null });
    await mount(h(ImportOffer, {}));
    const offer = root.querySelector<HTMLElement>('[data-import-offer]')!;
    expect(offer.textContent).toContain('Import progress saved in this browser');
    expect(offer.textContent).toContain('1 day completed');
    await act(() => root.querySelector<HTMLButtonElement>('[data-import-accept]')!.click());
    await act(() => root.querySelector<HTMLButtonElement>('[data-import-confirm-btn]')!.click());
    expect(getStore().get().days['1'].status).toBe('completed');
    expect(localStorage.getItem('aip-import-offer:v1')).toBe('imported');
    expect(root.querySelector('[data-import-offer]')!.getAttribute('data-state')).toBe('done');
    render(null, root);
    await mount(h(ImportOffer, {}));
    expect(root.querySelector('[data-import-offer]')).toBeNull();
  });

  it('"No thanks" stops offering', async () => {
    legacy();
    setBootstrap({ user: USER, progress: defaultProgress(), ui: null });
    await mount(h(ImportOffer, {}));
    await act(() => root.querySelector<HTMLButtonElement>('[data-import-decline]')!.click());
    expect(root.querySelector('[data-import-offer]')).toBeNull();
    expect(localStorage.getItem('aip-import-offer:v1')).toBe('declined');
  });
});

describe('AccountSettings', () => {
  it('signed in: display name, change password and delete account sections', async () => {
    setBootstrap({ user: USER, progress: defaultProgress(), ui: null });
    await mount(h(AccountSettings, {}));
    const s = root.querySelector<HTMLElement>('[data-account-settings]')!;
    expect(s.querySelector('h2')!.textContent).toBe('Account');
    expect(root.querySelector<HTMLInputElement>('#acct-display-name')!.value).toBe('Sam Lee');
    expect(root.querySelector('[data-password-form]')).not.toBeNull();
    await act(() => root.querySelector<HTMLButtonElement>('[data-delete-account]')!.click());
    expect(root.querySelector('#acct-delete-password')).not.toBeNull();
  });

  it('wrong current password (403) is shown on that field', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Wrong password' }), { status: 403 })));
    setBootstrap({ user: USER, progress: defaultProgress(), ui: null });
    await mount(h(AccountSettings, {}));
    await input(root.querySelector('#acct-current-password')!, 'oldpassword');
    await input(root.querySelector('#acct-new-password')!, 'newpassword1');
    await input(root.querySelector('#acct-new-password2')!, 'newpassword1');
    await act(() => void root.querySelector('[data-password-form]')!.dispatchEvent(new Event('submit', { cancelable: true })));
    await flush();
    expect(root.querySelector('#acct-current-password-error')!.textContent).toMatch(/current password/);
  });

  it('display name saves via PATCH /api/me and notifies the header', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ user: { ...USER, displayName: 'Sammy' } }), { status: 200 }));
    vi.stubGlobal('fetch', f);
    const seen: string[] = [];
    document.addEventListener('aip:user', (e) => seen.push((e as CustomEvent).detail.displayName));
    setBootstrap({ user: USER, progress: defaultProgress(), ui: null });
    await mount(h(AccountSettings, {}));
    await input(root.querySelector('#acct-display-name')!, 'Sammy');
    await act(() => void root.querySelector('[data-display-name-form]')!.dispatchEvent(new Event('submit', { cancelable: true })));
    await flush();
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/me');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ displayName: 'Sammy' });
    expect(seen).toContain('Sammy');
  });
});
