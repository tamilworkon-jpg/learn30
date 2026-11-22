// T189 — /login and /signup form island. Errors come inline from the API's { error, field }.
import { useEffect, useRef, useState } from 'preact/hooks';
import { apiJson, isApiError } from '../../lib/api';
import { nextFromLocation, validateDisplayName, validatePassword, validateUsername } from '../../lib/auth';
import { signupOpen } from '../../lib/bootstrap';
import '../../styles/account.css';

type Mode = 'login' | 'signup';
type Field = 'username' | 'password' | 'displayName';
type Errors = Partial<Record<Field | 'form', string>>;

export function PasswordInput(props: {
  id: string;
  label: string;
  value: string;
  onInput: (v: string) => void;
  autocomplete: string;
  error?: string;
  hint?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const [shown, setShown] = useState(false);
  const describedBy = [props.hint && `${props.id}-hint`, props.error && `${props.id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div class="auth-field">
      <label for={props.id}>{props.label}</label>
      <div class="password-row">
        <input
          ref={props.inputRef}
          id={props.id}
          class="auth-input"
          type={shown ? 'text' : 'password'}
          value={props.value}
          autocomplete={props.autocomplete}
          maxLength={128}
          aria-invalid={props.error ? 'true' : undefined}
          aria-describedby={describedBy}
          onInput={(e) => props.onInput((e.target as HTMLInputElement).value)}
          required
        />
        <button type="button" class="btn btn-ghost password-toggle" aria-controls={props.id} aria-pressed={shown ? 'true' : 'false'} onClick={() => setShown(!shown)} data-password-toggle>
          {shown ? 'Hide' : 'Show'}
          <span class="sr-only"> password</span>
        </button>
      </div>
      {props.hint && (
        <p class="auth-hint" id={`${props.id}-hint`}>
          {props.hint}
        </p>
      )}
      {props.error && (
        <p class="auth-error" id={`${props.id}-error`} data-field-error>
          {props.error}
        </p>
      )}
    </div>
  );
}

export function TextField(props: {
  id: string;
  label: string;
  value: string;
  onInput: (v: string) => void;
  autocomplete: string;
  maxLength: number;
  error?: string;
  hint?: string;
  required?: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const describedBy = [props.hint && `${props.id}-hint`, props.error && `${props.id}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div class="auth-field">
      <label for={props.id}>{props.label}</label>
      <input
        ref={props.inputRef}
        id={props.id}
        class="auth-input"
        type="text"
        value={props.value}
        autocomplete={props.autocomplete}
        autocapitalize="none"
        spellcheck={false}
        maxLength={props.maxLength}
        aria-invalid={props.error ? 'true' : undefined}
        aria-describedby={describedBy}
        onInput={(e) => props.onInput((e.target as HTMLInputElement).value)}
        required={props.required}
      />
      {props.hint && (
        <p class="auth-hint" id={`${props.id}-hint`}>
          {props.hint}
        </p>
      )}
      {props.error && (
        <p class="auth-error" id={`${props.id}-error`} data-field-error>
          {props.error}
        </p>
      )}
    </div>
  );
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState('/');
  const [ready, setReady] = useState(false);
  const [canSignup, setCanSignup] = useState(true);
  const inputs = useRef<Partial<Record<Field, HTMLInputElement | null>>>({});
  const formError = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setNext(nextFromLocation());
    setCanSignup(signupOpen());
    setReady(true);
  }, []);

  const focusFirstError = (e: Errors) => {
    const f = (['username', 'displayName', 'password'] as Field[]).find((k) => e[k]);
    if (f) inputs.current[f]?.focus();
    else if (e.form) formError.current?.focus();
  };

  const submit = async (ev: Event) => {
    ev.preventDefault();
    if (busy) return;
    const e: Errors = {};
    if (mode === 'signup') {
      const u = validateUsername(username);
      const p = validatePassword(password);
      const d = validateDisplayName(displayName);
      if (u) e.username = u;
      if (p) e.password = p;
      if (d) e.displayName = d;
    } else {
      if (!username.trim()) e.username = 'Enter your username.';
      if (!password) e.password = 'Enter your password.';
    }
    setErrors(e);
    if (Object.keys(e).length) return focusFirstError(e);
    setBusy(true);
    try {
      const body: Record<string, string> = { username: username.trim().toLowerCase(), password };
      if (mode === 'signup' && displayName.trim()) body.displayName = displayName.replace(/\s+/g, ' ').trim();
      await apiJson(mode === 'login' ? '/api/auth/login' : '/api/auth/signup', { method: 'POST', body });
      location.assign(next);
    } catch (err) {
      const msg = isApiError(err) ? err.error : 'Something went wrong. Please try again.';
      const field = isApiError(err) && (err.field === 'username' || err.field === 'password' || err.field === 'displayName') ? err.field : null;
      const ne: Errors = field ? { [field]: msg } : { form: msg };
      if (isApiError(err) && err.status === 409 && !field) {
        delete ne.form;
        ne.username = msg;
      }
      setErrors(ne);
      setBusy(false);
      queueMicrotask(() => focusFirstError(ne));
    }
  };

  const other = mode === 'login' ? '/signup' : '/login';
  const otherHref = next !== '/' ? `${other}?next=${encodeURIComponent(next)}` : other;
  const set = (f: Field, fn: (v: string) => void) => (v: string) => {
    fn(v);
    if (errors[f] || errors.form) setErrors({ ...errors, [f]: undefined, form: undefined });
  };

  return (
    <form
      class="auth-form card"
      noValidate
      onSubmit={submit}
      aria-labelledby="auth-title"
      data-login-form={mode === 'login' ? '' : undefined}
      data-signup-form={mode === 'signup' ? '' : undefined}
      data-ready={ready ? 'true' : undefined}
    >
      <h1 class="h1 auth-title" id="auth-title">
        {mode === 'login' ? 'Sign in' : 'Create your account'}
      </h1>
      <p class="muted mt-0">
        {mode === 'login' ? 'Sign in to save your progress and pick up where you left off on any device.' : 'Your progress, start date and quiz history are saved to your account.'}
      </p>
      <p class="auth-form-error" role="alert" tabIndex={-1} ref={formError} data-form-error>
        {errors.form ?? ''}
      </p>
      <TextField
        id="auth-username"
        label="Username"
        value={username}
        onInput={set('username', setUsername)}
        autocomplete="username"
        maxLength={30}
        required
        hint={mode === 'signup' ? '3–30 characters: letters, numbers, dots, dashes or underscores.' : undefined}
        error={errors.username}
        inputRef={(el) => (inputs.current.username = el)}
      />
      {mode === 'signup' && (
        <TextField
          id="auth-display-name"
          label="Display name (optional)"
          value={displayName}
          onInput={set('displayName', setDisplayName)}
          autocomplete="nickname"
          maxLength={30}
          hint="Shown in the header. Defaults to your username."
          error={errors.displayName}
          inputRef={(el) => (inputs.current.displayName = el)}
        />
      )}
      <PasswordInput
        id="auth-password"
        label="Password"
        value={password}
        onInput={set('password', setPassword)}
        autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
        hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
        error={errors.password}
        inputRef={(el) => (inputs.current.password = el)}
      />
      <button type="submit" class="btn auth-submit" disabled={busy}>
        {busy ? (mode === 'login' ? 'Signing in…' : 'Creating account…') : mode === 'login' ? 'Sign in' : 'Create account'}
      </button>
      {mode === 'login' && !canSignup ? (
        <p class="auth-switch" data-signup-closed>
          New here? Ask your administrator for a username and password.
        </p>
      ) : (
        <p class="auth-switch">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <a href={otherHref}>{mode === 'login' ? 'Create an account' : 'Sign in'}</a>
        </p>
      )}
    </form>
  );
}
