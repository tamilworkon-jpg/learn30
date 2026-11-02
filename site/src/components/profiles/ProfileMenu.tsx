// T184 — header "Who's learning?" menu: shows the active learner, switches profiles, adds a learner.
// Switching reloads the page so every island reads the new profile's progress.
import { useEffect, useRef, useState } from 'preact/hooks';
import { createProfiles, initials, type Profile } from '../../lib/progress/profiles';
import '../../styles/profiles.css';

function Avatar({ profile, size = 40 }: { profile: Profile | null; size?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  // Colour via CSSOM after mount (no inline style attribute in server HTML — strict CSP).
  useEffect(() => {
    if (ref.current && profile) ref.current.style.backgroundColor = profile.color;
  }, [profile]);
  return (
    <span ref={ref} class={`avatar profile-avatar${size < 40 ? ' profile-avatar-sm' : ''}`} aria-hidden="true">
      {profile ? initials(profile.name) : 'You'}
    </span>
  );
}

export default function ProfileMenu() {
  const [profiles, setProfiles] = useState<ReturnType<typeof createProfiles> | null>(null);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => setProfiles(createProfiles()), []);
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
    root.current?.querySelector<HTMLElement>('[data-profile-item][aria-current="true"], [data-profile-item]')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const active = profiles?.active() ?? null;
  const switchTo = (id: string) => {
    if (!profiles || id === active?.id) return setOpen(false);
    profiles.switchTo(id);
    location.reload();
  };
  const add = (e: Event) => {
    e.preventDefault();
    if (!profiles) return;
    try {
      const p = profiles.add(name);
      profiles.switchTo(p.id);
      location.reload();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div class="profile-menu" ref={root} data-profile-menu data-ready={profiles ? 'true' : undefined}>
      <button
        ref={button}
        type="button"
        class="profile-trigger"
        aria-haspopup="true"
        aria-expanded={open ? 'true' : 'false'}
        aria-label={active ? `Learner: ${active.name}. Switch learner` : 'Switch learner'}
        onClick={() => setOpen(!open)}
      >
        <Avatar profile={active} />
      </button>
      {open && profiles && (
        <div class="profile-panel card" role="dialog" aria-label="Who's learning?">
          <p class="profile-panel-title">Who's learning?</p>
          <ul class="profile-list">
            {profiles.list().map((p) => (
              <li key={p.id}>
                <button type="button" class="profile-item" data-profile-item={p.id} aria-current={p.id === active?.id ? 'true' : undefined} onClick={() => switchTo(p.id)}>
                  <Avatar profile={p} size={28} />
                  <span class="flex-1 text-left">{p.name}</span>
                  {p.id === active?.id && <span class="muted text-sm">current</span>}
                </button>
              </li>
            ))}
          </ul>
          {adding ? (
            <form class="profile-add" onSubmit={add}>
              <label class="text-sm font-medium" for="new-learner">
                New learner's name
              </label>
              <div class="flex gap-2 mt-1">
                <input
                  id="new-learner"
                  class="profile-input"
                  maxLength={30}
                  value={name}
                  onInput={(e) => {
                    setName((e.target as HTMLInputElement).value);
                    setError('');
                  }}
                  ref={(el) => el?.focus()}
                  required
                />
                <button type="submit" class="btn">
                  Add
                </button>
              </div>
              {error && (
                <p class="profile-error" role="alert">
                  {error}
                </p>
              )}
            </form>
          ) : (
            <button type="button" class="btn btn-ghost w-full mt-2" onClick={() => setAdding(true)}>
              + Add learner
            </button>
          )}
          <a class="text-sm mt-2 block" href="/settings#learners">
            Manage learners & start dates
          </a>
        </div>
      )}
    </div>
  );
}
