// Admin console island: learners' progress per course (overview + per-learner detail) and account management
// (create with username + password, reset password, grant/remove admin, delete). Data: /api/admin/users….
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { apiJson, isApiError } from '../../lib/api';
import { validateDisplayName, validatePassword, validateUsername } from '../../lib/auth';
import { currentUser } from '../../lib/bootstrap';
import { PasswordInput, TextField } from '../account/AuthForm';
import '../../styles/account.css';
import '../../styles/admin.css';

interface CourseInfo {
  id: string;
  title: string;
  lengthDays: number;
}

interface CourseStats {
  startedAt: string | null;
  updatedAt: string;
  completed: number;
  inProgress: number;
  attempts: number;
  averageScore: number | null;
  bestMock: number | null;
  streak: { current: number; longest: number };
  lastPosition: { day: number; sectionId: string; updatedAt: string } | null;
}

interface AdminUser {
  id: number;
  username: string;
  displayName: string;
  isAdmin: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  lastActiveAt: string | null;
  courses: Record<string, CourseStats>;
}

interface ListResponse {
  users: AdminUser[];
  courseIds: string[];
  signupOpen: boolean;
  maxUsers: number;
}

interface Detail {
  user: AdminUser;
  detail: Record<
    string,
    {
      stats: CourseStats;
      days: Record<string, { status: string; completedAt: string | null; bestScore: number | null }>;
      attempts: { assessmentId: string; kind: string; submittedAt: string; percent: number | null; scaled: number | null; correct: number | null; total: number | null }[];
    }
  >;
}

type Msg = { kind: 'ok' | 'err'; text: string } | null;
const errText = (e: unknown) => (isApiError(e) ? e.error : 'Something went wrong. Please try again.');

function when(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Status({ msg }: { msg: Msg }) {
  return (
    <p class={`account-msg ${msg?.kind === 'err' ? 'is-error' : msg ? 'is-ok' : ''}`} role={msg?.kind === 'err' ? 'alert' : 'status'} data-admin-msg>
      {msg?.text ?? ''}
    </p>
  );
}

function CreateUser({ onCreated }: { onCreated: () => void }) {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [makeAdmin, setMakeAdmin] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<'username' | 'displayName' | 'password', string>>>({});
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (ev: Event) => {
    ev.preventDefault();
    if (busy) return;
    const e = {
      username: validateUsername(username) ?? undefined,
      displayName: validateDisplayName(displayName) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setErrors(e);
    setMsg(null);
    if (e.username || e.displayName || e.password) return;
    setBusy(true);
    const name = username.trim().toLowerCase();
    try {
      const body: Record<string, unknown> = { username: name, password, isAdmin: makeAdmin };
      if (displayName.trim()) body.displayName = displayName.replace(/\s+/g, ' ').trim();
      await apiJson('/api/admin/users', { method: 'POST', body });
      onCreated();
      setMsg({ kind: 'ok', text: `Account "${name}" created. Share the username and password with the learner.` });
      setUsername('');
      setDisplayName('');
      setPassword('');
      setMakeAdmin(false);
    } catch (err) {
      const field = isApiError(err) ? err.field : undefined;
      if (field === 'username' || field === 'password' || field === 'displayName') setErrors({ [field]: errText(err) });
      else setMsg({ kind: 'err', text: errText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form class="card admin-create" onSubmit={submit} noValidate aria-labelledby="admin-create-h" data-admin-create>
      <h2 class="h2 mt-0" id="admin-create-h">
        Give a learner access
      </h2>
      <p class="muted mt-0">Create a username and password, then share them with the learner. They can change the password later in Settings.</p>
      <div class="admin-create-grid">
        <TextField id="new-username" label="Username" value={username} onInput={setUsername} autocomplete="off" maxLength={30} required error={errors.username} hint="3–30 characters: a–z, 0–9, . _ -" />
        <TextField id="new-display" label="Display name (optional)" value={displayName} onInput={setDisplayName} autocomplete="off" maxLength={30} error={errors.displayName} />
        <PasswordInput id="new-password" label="Password" value={password} onInput={setPassword} autocomplete="new-password" error={errors.password} hint="At least 8 characters." />
      </div>
      <label class="admin-check">
        <input type="checkbox" checked={makeAdmin} onChange={(e) => setMakeAdmin((e.target as HTMLInputElement).checked)} /> Make this account an admin
      </label>
      <div class="admin-actions">
        <button type="submit" class="btn" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </div>
      <Status msg={msg} />
    </form>
  );
}

function CourseCell({ stats, course }: { stats: CourseStats | undefined; course: CourseInfo }) {
  if (!stats) return <span class="muted admin-small">Not started</span>;
  const done = Math.min(stats.completed, course.lengthDays);
  const pct = Math.round((done / course.lengthDays) * 100);
  return (
    <div class="admin-course">
      <div class="admin-bar-row">
        <progress max={course.lengthDays} value={done} aria-label={`${course.title}: ${stats.completed} of ${course.lengthDays} days`} />
        <span class="admin-pct">{pct}%</span>
      </div>
      <span class="muted admin-small">
        {stats.completed}/{course.lengthDays} days
        {stats.inProgress ? ` · ${stats.inProgress} in progress` : ''}
        {stats.averageScore !== null ? ` · avg ${stats.averageScore}%` : ''}
        {stats.bestMock !== null ? ` · best mock ${stats.bestMock}` : ''}
      </span>
    </div>
  );
}

function UserDetail({ id, courses, onClose }: { id: number; courses: CourseInfo[]; onClose: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    apiJson<Detail>(`/api/admin/users/${id}`)
      .then((d) => setData(d))
      .catch((e: unknown) => setError(errText(e)));
  }, [id]);
  if (error) return <p class="account-msg is-error">{error}</p>;
  if (!data) return <p class="muted">Loading…</p>;
  const ids = Object.keys(data.detail);
  return (
    <div class="admin-detail" data-admin-detail>
      <div class="admin-detail-head">
        <h3 class="h3 m-0">
          {data.user.displayName} <span class="muted">@{data.user.username}</span>
        </h3>
        <button type="button" class="btn btn-ghost" onClick={onClose}>
          Close
        </button>
      </div>
      {ids.length === 0 && <p class="muted">This learner has not opened any course yet.</p>}
      {ids.map((cid) => {
        const c = courses.find((x) => x.id === cid) ?? { id: cid, title: cid, lengthDays: 30 };
        const d = data.detail[cid];
        return (
          <section key={cid} class="admin-detail-course">
            <h4 class="m-0">{c.title}</h4>
            <p class="muted admin-small m-0">
              Started {when(d.stats.startedAt)} · last saved {when(d.stats.updatedAt)} · streak {d.stats.streak.current} (best {d.stats.streak.longest})
              {d.stats.lastPosition ? ` · last at day ${d.stats.lastPosition.day}` : ''}
            </p>
            <ol class="admin-days" aria-label={`${c.title}: day status`}>
              {Array.from({ length: c.lengthDays }, (_, i) => {
                const s = d.days[String(i + 1)]?.status ?? 'not-started';
                const label = s === 'completed' ? 'completed' : s === 'in-progress' ? 'in progress' : 'not started';
                return (
                  <li key={i} class={`admin-day is-${s}`} title={`Day ${i + 1}: ${label}`}>
                    <span aria-hidden="true">{i + 1}</span>
                    <span class="sr-only">
                      Day {i + 1}: {label}
                    </span>
                  </li>
                );
              })}
            </ol>
            {d.attempts.length > 0 ? (
              <div class="admin-table-wrap">
                <table class="admin-table admin-attempts">
                  <caption class="sr-only">{c.title}: submitted attempts</caption>
                  <thead>
                    <tr>
                      <th scope="col">Assessment</th>
                      <th scope="col">Kind</th>
                      <th scope="col">Submitted</th>
                      <th scope="col">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...d.attempts].reverse().map((a, i) => (
                      <tr key={i}>
                        <td>{a.assessmentId}</td>
                        <td>{a.kind}</td>
                        <td>{when(a.submittedAt)}</td>
                        <td>
                          {a.correct !== null && a.total !== null ? `${a.correct}/${a.total}` : ''}
                          {a.percent !== null ? ` (${a.percent}%)` : ''}
                          {a.scaled !== null ? ` · ${a.scaled}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p class="muted admin-small m-0">No quizzes or tests submitted yet.</p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function ResetPassword({ user, onDone }: { user: AdminUser; onDone: (m: Msg) => void }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (ev: Event) => {
    ev.preventDefault();
    const e = validatePassword(pw);
    setError(e ?? undefined);
    if (e || busy) return;
    setBusy(true);
    try {
      await apiJson(`/api/admin/users/${user.id}`, { method: 'PATCH', body: { password: pw } });
      onDone({ kind: 'ok', text: `Password for "${user.username}" reset. They were signed out on every device.` });
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  };
  return (
    <form class="admin-inline" onSubmit={submit} noValidate data-admin-reset>
      <PasswordInput id={`reset-${user.id}`} label={`New password for ${user.username}`} value={pw} onInput={setPw} autocomplete="new-password" error={error} />
      <div class="admin-actions">
        <button type="submit" class="btn" disabled={busy}>
          {busy ? 'Saving…' : 'Set password'}
        </button>
        <button type="button" class="btn btn-ghost" onClick={() => onDone(null)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminPanel({ courses }: { courses: CourseInfo[] }) {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<number | null>(null);
  const [resetting, setResetting] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [meId, setMeId] = useState<number | null>(null);

  const load = () =>
    apiJson<ListResponse>('/api/admin/users')
      .then((d) => {
        setData(d);
        setLoadError('');
      })
      .catch((e: unknown) => setLoadError(errText(e)));

  useEffect(() => {
    setMeId(currentUser()?.id ?? null);
    void load();
  }, []);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const users = data?.users ?? [];
    return q ? users.filter((u) => u.username.includes(q) || u.displayName.toLowerCase().includes(q)) : users;
  }, [data, filter]);

  const activeWeek = (data?.users ?? []).filter((u) => u.lastActiveAt && Date.now() - Date.parse(u.lastActiveAt) < 7 * 864e5).length;
  const cols = courses.length + 4;

  const setRole = async (u: AdminUser, isAdmin: boolean) => {
    try {
      await apiJson(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { isAdmin } });
      setMsg({ kind: 'ok', text: isAdmin ? `"${u.username}" is now an admin.` : `"${u.username}" is no longer an admin.` });
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: errText(e) });
    }
  };

  const remove = async (u: AdminUser) => {
    if (!confirm(`Delete "${u.username}" and all of their progress? This cannot be undone.`)) return;
    try {
      await apiJson(`/api/admin/users/${u.id}`, { method: 'DELETE' });
      setMsg({ kind: 'ok', text: `"${u.username}" was deleted.` });
      if (open === u.id) setOpen(null);
      await load();
    } catch (e) {
      setMsg({ kind: 'err', text: errText(e) });
    }
  };

  return (
    <div class="admin" data-admin data-ready={data || loadError ? 'true' : undefined}>
      <h1 class="h1">Admin console</h1>
      <p class="muted mt-0 max-w-3xl">
        Everyone's progress in every course, and the accounts that can sign in.
        {data && !data.signupOpen ? ' Public sign-up is closed: only admins create accounts.' : ''}
      </p>
      {loadError && <p class="account-msg is-error">{loadError}</p>}
      {data && (
        <ul class="admin-stats" aria-label="Summary">
          <li class="card">
            <strong>{data.users.length}</strong>
            <span class="muted">accounts (max {data.maxUsers})</span>
          </li>
          <li class="card">
            <strong>{data.users.filter((u) => u.isAdmin).length}</strong>
            <span class="muted">admins</span>
          </li>
          <li class="card">
            <strong>{activeWeek}</strong>
            <span class="muted">active in the last 7 days</span>
          </li>
        </ul>
      )}

      <CreateUser onCreated={() => void load()} />

      <section class="card mt-6" aria-labelledby="admin-users-h">
        <div class="admin-list-head">
          <h2 class="h2 m-0" id="admin-users-h">
            Learners and progress
          </h2>
          <div class="admin-actions">
            <label class="sr-only" for="admin-filter">
              Filter by name
            </label>
            <input id="admin-filter" class="auth-input admin-filter" type="search" placeholder="Filter by name…" value={filter} onInput={(e) => setFilter((e.target as HTMLInputElement).value)} />
            <button type="button" class="btn btn-ghost" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>
        <Status msg={msg} />
        {data && (
          <div class="admin-table-wrap">
            <table class="admin-table" data-admin-users>
              <caption class="sr-only">Learners, their progress per course and account actions</caption>
              <thead>
                <tr>
                  <th scope="col">Learner</th>
                  {courses.map((c) => (
                    <th scope="col" key={c.id}>
                      {c.title}
                    </th>
                  ))}
                  <th scope="col">Last sign-in</th>
                  <th scope="col">Last activity</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((u) => (
                  <Fragment key={u.id}>
                    <tr data-user={u.username}>
                      <th scope="row">
                        <span class="admin-name">{u.displayName}</span>
                        <span class="muted admin-small">
                          @{u.username}
                          {u.isAdmin && (
                            <>
                              {' '}
                              <span class="admin-badge">admin</span>
                            </>
                          )}
                        </span>
                      </th>
                      {courses.map((c) => (
                        <td key={c.id}>
                          <CourseCell stats={u.courses[c.id]} course={c} />
                        </td>
                      ))}
                      <td class="admin-small">{when(u.lastLoginAt)}</td>
                      <td class="admin-small">{when(u.lastActiveAt)}</td>
                      <td>
                        <div class="admin-row-actions">
                          <button type="button" class="btn btn-ghost" aria-expanded={open === u.id ? 'true' : 'false'} onClick={() => setOpen(open === u.id ? null : u.id)} data-admin-details>
                            {open === u.id ? 'Hide' : 'Details'}
                          </button>
                          <button type="button" class="btn btn-ghost" onClick={() => setResetting(resetting === u.id ? null : u.id)} data-admin-reset-open>
                            Reset password
                          </button>
                          {u.id !== meId && (
                            <>
                              <button type="button" class="btn btn-ghost" onClick={() => void setRole(u, !u.isAdmin)}>
                                {u.isAdmin ? 'Remove admin' : 'Make admin'}
                              </button>
                              <button type="button" class="btn btn-ghost admin-danger" onClick={() => void remove(u)} data-admin-delete>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {resetting === u.id && (
                      <tr>
                        <td colSpan={cols}>
                          <ResetPassword
                            user={u}
                            onDone={(m) => {
                              setResetting(null);
                              if (m) setMsg(m);
                            }}
                          />
                        </td>
                      </tr>
                    )}
                    {open === u.id && (
                      <tr>
                        <td colSpan={cols}>
                          <UserDetail id={u.id} courses={courses} onClose={() => setOpen(null)} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={cols} class="muted">
                      No matching accounts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
