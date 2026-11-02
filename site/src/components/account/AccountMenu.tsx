// T189 — header account menu (replaces the local "Who's learning?" ProfileMenu).
// Signed in: initials avatar → name, @username, Settings, Log out. Signed out: "Sign in" link.
import { useEffect, useRef, useState } from 'preact/hooks';
import { initials, loginHref, logout } from '../../lib/auth';
import { currentUser, type User } from '../../lib/bootstrap';
import '../../styles/account.css';

/** Fired by Settings → Account after a display-name change so the header updates without a reload. */
export const USER_EVENT = 'aip:user';

export default function AccountMenu() {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [href, setHref] = useState('/login');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setUser(currentUser());
    setHref(loginHref(location.pathname + location.search));
    setReady(true);
    const onUser = (e: Event) => setUser((e as CustomEvent<User>).detail);
    document.addEventListener(USER_EVENT, onUser);
    return () => document.removeEventListener(USER_EVENT, onUser);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        button.current?.focus();
      }
    };
    const onClick = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    root.current?.querySelector<HTMLElement>('.account-item')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const signedIn = ready && user !== null;
  return (
    <div class="account-menu" ref={root} data-account-menu data-ready={ready ? 'true' : undefined} data-signed-in={ready ? String(signedIn) : undefined}>
      {ready && !user && (
        <a class="btn account-signin" href={href} data-sign-in>
          Sign in
        </a>
      )}
      {user && (
        <>
          <button
            ref={button}
            type="button"
            class="account-trigger"
            aria-haspopup="true"
            aria-expanded={open ? 'true' : 'false'}
            aria-controls="account-panel"
            onClick={() => setOpen(!open)}
            data-account-trigger
          >
            <span class="avatar account-avatar" aria-hidden="true">
              {initials(user.displayName)}
            </span>
            <span class="sr-only">Account: {user.displayName}</span>
          </button>
          {open && (
            <div class="account-panel card" id="account-panel" role="group" aria-label="Account">
              <p class="account-name" data-account-name>
                {user.displayName}
              </p>
              <p class="account-username muted" data-account-username>
                @{user.username}
              </p>
              <a class="account-item" href="/settings#account">
                Settings
              </a>
              <button
                type="button"
                class="account-item"
                data-logout
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void logout();
                }}
              >
                {busy ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
