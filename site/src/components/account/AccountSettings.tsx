// T189 — Settings → Account: display name, change password, delete account (password confirmation).
import { useEffect, useRef, useState } from 'preact/hooks';
import { apiFetch, apiJson, isApiError, settleAll } from '../../lib/api';
import { validateDisplayName, validatePassword } from '../../lib/auth';
import { currentUser, type User } from '../../lib/bootstrap';
import { PasswordInput, TextField } from './AuthForm';
import { USER_EVENT } from './AccountMenu';
import '../../styles/account.css';

type Msg = { kind: 'ok' | 'err'; text: string } | null;
const errText = (e: unknown) => (isApiError(e) ? e.error : 'Something went wrong. Please try again.');

function Status({ msg, hook }: { msg: Msg; hook: string }) {
  return (
    <p class={`account-msg ${msg?.kind === 'err' ? 'is-error' : msg ? 'is-ok' : ''}`} role={msg?.kind === 'err' ? 'alert' : 'status'} {...{ [hook]: '' }}>
      {msg?.text ?? ''}
    </p>
  );
}

export default function AccountSettings() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setUser(currentUser());
    setReady(true);
  }, []);

  // display name
  const [name, setName] = useState('');
  const [nameErr, setNameErr] = useState<string>();
  const [nameMsg, setNameMsg] = useState<Msg>(null);
  useEffect(() => setName(user?.displayName ?? ''), [user?.displayName]);

  // password
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [pwErr, setPwErr] = useState<{ cur?: string; pw?: string; pw2?: string }>({});
  const [pwMsg, setPwMsg] = useState<Msg>(null);

  // delete
  const [confirmDel, setConfirmDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const [delErr, setDelErr] = useState<string>();
  const [busy, setBusy] = useState<'' | 'name' | 'pw' | 'del'>('');
  const delPanel = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (confirmDel) delPanel.current?.focus();
  }, [confirmDel]);

  if (ready && !user) {
    return (
      <section class="card mt-6" id="account" aria-labelledby="account-h" data-account-settings data-ready="true">
        <h2 class="h2 mt-0" id="account-h">
          Account
        </h2>
        <p class="m-0">
          You're not signed in. <a href="/login?next=%2Fsettings">Sign in</a> to manage your account and save your progress.
        </p>
      </section>
    );
  }

  const saveName = async (e: Event) => {
    e.preventDefault();
    setNameMsg(null);
    const clean = name.replace(/\s+/g, ' ').trim();
    const err = !clean ? 'Enter a display name.' : validateDisplayName(clean);
    setNameErr(err ?? undefined);
    if (err) return;
    setBusy('name');
    try {
      const res = await apiJson<{ user: User }>('/api/me', { method: 'PATCH', body: { displayName: clean } });
      const next = res?.user ?? { ...user!, displayName: clean };
      setUser(next);
      document.dispatchEvent(new CustomEvent(USER_EVENT, { detail: next }));
      setNameMsg({ kind: 'ok', text: 'Display name saved.' });
    } catch (x) {
      if (isApiError(x) && x.field === 'displayName') setNameErr(x.error);
      else setNameMsg({ kind: 'err', text: errText(x) });
    } finally {
      setBusy('');
    }
  };

  const savePassword = async (e: Event) => {
    e.preventDefault();
    setPwMsg(null);
    const errs: typeof pwErr = {};
    if (!cur) errs.cur = 'Enter your current password.';
    const p = validatePassword(pw);
    if (p) errs.pw = p;
    if (!errs.pw && pw2 !== pw) errs.pw2 = 'The new passwords don’t match.';
    setPwErr(errs);
    if (Object.keys(errs).length) return;
    setBusy('pw');
    try {
      await apiJson('/api/me', { method: 'PATCH', body: { currentPassword: cur, newPassword: pw } });
      setCur('');
      setPw('');
      setPw2('');
      setPwMsg({ kind: 'ok', text: 'Password changed.' });
    } catch (x) {
      if (isApiError(x) && x.status === 403) setPwErr({ cur: 'That isn’t your current password.' });
      else if (isApiError(x) && (x.field === 'newPassword' || x.field === 'password')) setPwErr({ pw: x.error });
      else if (isApiError(x) && x.field === 'currentPassword') setPwErr({ cur: x.error });
      else setPwMsg({ kind: 'err', text: errText(x) });
    } finally {
      setBusy('');
    }
  };

  const deleteAccount = async (e: Event) => {
    e.preventDefault();
    if (!delPw) return setDelErr('Enter your password to confirm.');
    setBusy('del');
    setDelErr(undefined);
    await settleAll().catch(() => {});
    try {
      const res = await apiFetch('/api/me', { method: 'DELETE', body: { password: delPw } });
      if (res.status === 204 || res.ok) return location.assign('/login');
      setDelErr(res.status === 403 ? 'That password is incorrect.' : 'Your account could not be deleted. Please try again.');
    } catch {
      setDelErr("Couldn't reach the server. Check your connection and try again.");
    }
    setBusy('');
  };

  return (
    <section class="card mt-6" id="account" aria-labelledby="account-h" data-account-settings data-ready={ready ? 'true' : undefined}>
      <h2 class="h2 mt-0" id="account-h">
        Account
      </h2>
      {user && (
        <p class="muted mt-0 text-sm">
          Signed in as <strong data-account-username>@{user.username}</strong>. Your progress, start date and theme are saved to this account on the course server.
        </p>
      )}

      <form class="account-form" onSubmit={saveName} noValidate data-display-name-form>
        <h3 class="account-sub">Display name</h3>
        <TextField id="acct-display-name" label="Display name" value={name} onInput={(v) => (setName(v), setNameErr(undefined))} autocomplete="nickname" maxLength={30} required error={nameErr} />
        <div>
          <button class="btn" type="submit" disabled={busy === 'name' || !user}>
            Save display name
          </button>
        </div>
        <Status msg={nameMsg} hook="data-name-status" />
      </form>

      <form class="account-form" onSubmit={savePassword} noValidate data-password-form>
        <h3 class="account-sub">Change password</h3>
        <PasswordInput id="acct-current-password" label="Current password" value={cur} onInput={(v) => (setCur(v), setPwErr({ ...pwErr, cur: undefined }))} autocomplete="current-password" error={pwErr.cur} />
        <PasswordInput id="acct-new-password" label="New password" value={pw} onInput={(v) => (setPw(v), setPwErr({ ...pwErr, pw: undefined }))} autocomplete="new-password" hint="At least 8 characters." error={pwErr.pw} />
        <PasswordInput id="acct-new-password2" label="Confirm new password" value={pw2} onInput={(v) => (setPw2(v), setPwErr({ ...pwErr, pw2: undefined }))} autocomplete="new-password" error={pwErr.pw2} />
        <div>
          <button class="btn" type="submit" disabled={busy === 'pw' || !user}>
            Change password
          </button>
        </div>
        <Status msg={pwMsg} hook="data-password-status" />
      </form>

      <div class="account-form">
        <h3 class="account-sub">Delete account</h3>
        <p class="m-0 text-sm">Deletes your account and all of its progress from the server. Export your progress first if you might want it back.</p>
        {confirmDel ? (
          <form class="confirm-panel danger" ref={delPanel} tabIndex={-1} onSubmit={deleteAccount} noValidate aria-labelledby="del-acct-h" data-delete-account-confirm>
            <p class="m-0 font-semibold" id="del-acct-h">
              Delete your account? This cannot be undone.
            </p>
            <PasswordInput id="acct-delete-password" label="Your password" value={delPw} onInput={(v) => (setDelPw(v), setDelErr(undefined))} autocomplete="current-password" error={delErr} />
            <div class="flex flex-wrap gap-2">
              <button type="submit" class="btn btn-danger" disabled={busy === 'del'}>
                Delete my account
              </button>
              <button type="button" class="btn btn-ghost" onClick={() => (setConfirmDel(false), setDelPw(''), setDelErr(undefined))}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div>
            <button type="button" class="btn btn-outline" onClick={() => setConfirmDel(true)} disabled={!user} data-delete-account>
              Delete account…
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
