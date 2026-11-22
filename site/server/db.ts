import { openAdapter, type Db, type DbOps, type DbSpec } from './db-adapter';

export type { Db, DbOps, DbSpec } from './db-adapter';

/** The first course: pre-Learn30 progress rows belong to it (spec 002 contracts/progress-api-v2.md). */
export const DEFAULT_COURSE_ID = 'aws-ai-practitioner';

type Migration = string | ((db: DbOps) => Promise<void>);

/** Learn30 v2: progress per (user, course); a learner's theme moves from progress to ui_state. */
async function perCourseProgress(db: DbOps): Promise<void> {
  await db.exec(`CREATE TABLE progress_v2 (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     course_id TEXT NOT NULL,
     doc TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     PRIMARY KEY (user_id, course_id)
   );`);
  await db.run('INSERT INTO progress_v2 (user_id, course_id, doc, updated_at) SELECT user_id, ?, doc, updated_at FROM progress', DEFAULT_COURSE_ID);
  // Theme: progress.settings.theme → ui_state.theme (only where the UI state has none).
  const rows = await db.all<{ id: number; pdoc: string; udoc: string | null }>(
    'SELECT p.user_id AS id, p.doc AS pdoc, u.doc AS udoc FROM progress p LEFT JOIN ui_state u ON u.user_id = p.user_id',
  );
  const now = new Date().toISOString();
  for (const r of rows) {
    let theme: unknown;
    try {
      theme = (JSON.parse(r.pdoc) as { settings?: { theme?: unknown } }).settings?.theme;
    } catch {
      continue;
    }
    if (theme !== 'light' && theme !== 'dark') continue;
    let ui: Record<string, unknown>;
    try {
      ui = r.udoc ? (JSON.parse(r.udoc) as Record<string, unknown>) : {};
    } catch {
      ui = {};
    }
    if (ui.theme) continue;
    ui.theme = theme;
    await db.run(
      'INSERT INTO ui_state (user_id, doc, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at',
      r.id,
      JSON.stringify(ui),
      now,
    );
  }
  await db.exec('DROP TABLE progress; ALTER TABLE progress_v2 RENAME TO progress;');
}

/** Schema migrations, applied in order; the stored version = number of migrations applied. */
const MIGRATIONS: Migration[] = [
  `CREATE TABLE users (
     id INTEGER PRIMARY KEY,
     username TEXT NOT NULL UNIQUE COLLATE NOCASE,
     display_name TEXT NOT NULL,
     pass_hash TEXT NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE TABLE sessions (
     token_hash TEXT PRIMARY KEY,
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE TABLE progress (
     user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     doc TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE ui_state (
     user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     doc TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );`,
  perCourseProgress,
  // Admin accounts (manage learners, view everyone's progress) and the last sign-in time shown to admins.
  `ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
   ALTER TABLE users ADD COLUMN last_login_at TEXT;`,
];

export const SCHEMA_VERSION = MIGRATIONS.length;

/** Open the database and apply pending migrations (each in its own transaction; safe when instances start together). */
export async function openDb(spec: DbSpec | string): Promise<Db> {
  const db = await openAdapter(typeof spec === 'string' ? { path: spec } : spec);
  try {
    for (;;) {
      const done = await db.transaction(async (t) => {
        const v = await db.getVersion(t);
        if (v >= MIGRATIONS.length) return true;
        const m = MIGRATIONS[v];
        if (typeof m === 'string') await t.exec(m);
        else await m(t);
        await db.setVersion(t, v + 1);
        return false;
      });
      if (done) break;
    }
  } catch (e) {
    await db.close();
    throw e;
  }
  return db;
}
