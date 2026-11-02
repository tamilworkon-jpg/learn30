// T183/T184 — settings: manage learner profiles and the active learner's course start date.
import { useEffect, useState } from 'preact/hooks';
import { createProfiles, initials, type Profile } from '../../lib/progress/profiles';
import { getStore } from '../../lib/progress/store';
import { COURSE_DAYS, finishDate, formatDate, fromDateInput, toDateInput } from '../../lib/schedule';
import '../../styles/profiles.css';

export default function LearnerSettings() {
  const [profiles, setProfiles] = useState<ReturnType<typeof createProfiles> | null>(null);
  const [list, setList] = useState<Profile[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [start, setStart] = useState('');

  useEffect(() => {
    const p = createProfiles();
    setProfiles(p);
    setList([...p.list()]);
    setStart(toDateInput(new Date(getStore().get().startedAt)));
  }, []);

  const refresh = () => profiles && setList([...profiles.list()]);
  const run = (fn: () => void, ok: string) => {
    try {
      fn();
      refresh();
      setMsg({ kind: 'ok', text: ok });
    } catch (e) {
      setMsg({ kind: 'err', text: (e as Error).message });
    }
  };
  const active = profiles?.active();

  let finishPreview = '';
  try {
    finishPreview = start ? formatDate(finishDate(fromDateInput(start))) : '';
  } catch {
    finishPreview = '';
  }

  return (
    <div data-learner-settings data-ready={profiles ? 'true' : undefined}>
      <section class="card mt-6" id="learners" aria-labelledby="learners-h">
        <h2 class="h2 mt-0" id="learners-h">
          Learners
        </h2>
        <p class="muted mt-0 text-sm">
          Each learner has separate progress, start date, quiz attempts and theme in this browser. No passwords — anyone using this browser can switch learners.
        </p>
        <ul class="list-none p-0 m-0">
          {list.map((p) => (
            <li key={p.id} class="learner-row" data-learner={p.id}>
              <span class="avatar profile-avatar profile-avatar-sm" aria-hidden="true" ref={(el) => {
                  if (el) el.style.backgroundColor = p.color;
                }}>
                {initials(p.name)}
              </span>
              {editing === p.id ? (
                <form
                  class="flex flex-1 gap-2 flex-wrap"
                  onSubmit={(e) => {
                    e.preventDefault();
                    run(() => profiles!.rename(p.id, draft), 'Learner renamed.');
                    setEditing(null);
                  }}
                >
                  <label class="sr-only" for={`rename-${p.id}`}>
                    New name for {p.name}
                  </label>
                  <input id={`rename-${p.id}`} class="profile-input" maxLength={30} value={draft} onInput={(e) => setDraft((e.target as HTMLInputElement).value)} required />
                  <button class="btn" type="submit">
                    Save
                  </button>
                  <button class="btn btn-ghost" type="button" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span class="flex-1 font-medium">
                    {p.name} {p.id === active?.id && <span class="muted text-sm">(current)</span>}
                  </span>
                  {p.id !== active?.id && (
                    <button
                      class="btn btn-ghost"
                      type="button"
                      onClick={() => {
                        profiles!.switchTo(p.id);
                        location.reload();
                      }}
                    >
                      Switch to
                    </button>
                  )}
                  <button
                    class="btn btn-ghost"
                    type="button"
                    aria-label={`Rename ${p.name}`}
                    onClick={() => {
                      setEditing(p.id);
                      setDraft(p.name);
                    }}
                  >
                    Rename
                  </button>
                  {list.length > 1 && (
                    <button class="btn btn-ghost" type="button" aria-label={`Delete ${p.name}`} onClick={() => setConfirmDelete(p.id)}>
                      Delete
                    </button>
                  )}
                </>
              )}
              {confirmDelete === p.id && (
                <div class="card quiz-confirm w-full" role="alertdialog" aria-labelledby={`del-${p.id}`}>
                  <p class="m-0 font-semibold" id={`del-${p.id}`}>
                    Delete {p.name} and all of their progress?
                  </p>
                  <p class="m-0 text-sm">This cannot be undone. Export their progress first if you want a backup.</p>
                  <div class="flex gap-2 mt-2 flex-wrap">
                    <button class="btn btn-ghost" type="button" ref={(el) => el?.focus()} onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </button>
                    <button
                      class="btn"
                      type="button"
                      onClick={() => {
                        const wasActive = p.id === active?.id;
                        run(() => profiles!.remove(p.id), `${p.name} deleted.`);
                        setConfirmDelete(null);
                        if (wasActive) location.reload();
                      }}
                    >
                      Yes, delete {p.name}
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form
          class="flex gap-2 flex-wrap mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => profiles!.add(newName), `Learner "${newName.trim()}" added — switch to them to start their course.`);
            setNewName('');
          }}
        >
          <label class="sr-only" for="add-learner">
            New learner's name
          </label>
          <input id="add-learner" class="profile-input" placeholder="New learner's name" maxLength={30} value={newName} onInput={(e) => setNewName((e.target as HTMLInputElement).value)} required />
          <button class="btn" type="submit">
            Add learner
          </button>
        </form>
        {msg && (
          <p class={`mt-2 mb-0 text-sm ${msg.kind === 'err' ? 'profile-error' : ''}`} role={msg.kind === 'err' ? 'alert' : 'status'}>
            {msg.text}
          </p>
        )}
      </section>

      <section class="card mt-6" id="schedule" aria-labelledby="schedule-h">
        <h2 class="h2 mt-0" id="schedule-h">
          Your schedule{active ? ` — ${active.name}` : ''}
        </h2>
        <p class="muted mt-0 text-sm">
          Day 1 is your start date; each day after that is one lesson day, so the {COURSE_DAYS}-day plan finishes {COURSE_DAYS - 1} days later. Dates use this device's calendar.
        </p>
        <form
          class="flex gap-2 flex-wrap items-end"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => getStore().setStartDate(fromDateInput(start)), `Start date saved. You finish on ${finishPreview}.`);
          }}
        >
          <label class="flex flex-col text-sm font-medium">
            Start date
            <input class="schedule-input" type="date" value={start} onInput={(e) => setStart((e.target as HTMLInputElement).value)} required data-start-input />
          </label>
          <button class="btn" type="submit">
            Save start date
          </button>
          {finishPreview && (
            <span class="text-sm" data-finish-preview>
              Finish by <strong>{finishPreview}</strong>
            </span>
          )}
        </form>
      </section>
    </div>
  );
}
