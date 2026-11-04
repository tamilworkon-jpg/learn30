import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/** The first course: pre-Learn30 progress rows belong to it (spec 002 contracts/progress-api-v2.md). */
export const DEFAULT_COURSE_ID = 'aws-ai-practitioner';

type Migration = string | ((db: DatabaseSync) => void);

/** Learn30 v2: progress per (user, course); a learner's theme moves from progress to ui_state. */
function perCourseProgress(db: DatabaseSync): void {
  db.exec(`CREATE TABLE progress_v2 (
     user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     course_id TEXT NOT NULL,
     doc TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     PRIMARY KEY (user_id, course_id)
   );`);
  db.prepare('INSERT INTO progress_v2 (user_id, course_id, doc, updated_at) SELECT user_id, ?, doc, updated_at FROM progress').run(DEFAULT_COURSE_ID);
  // Theme: progress.settings.theme → ui_state.theme (only where the UI state has none).
  const rows = db.prepare('SELECT p.user_id AS id, p.doc AS pdoc, u.doc AS udoc FROM progress p LEFT JOIN ui_state u ON u.user_id = p.user_id').all() as { id: number; pdoc: string; udoc: string | null }[];
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
    db.prepare('INSERT INTO ui_state (user_id, doc, updated_at) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET doc = excluded.doc, updated_at = excluded.updated_at').run(r.id, JSON.stringify(ui), now);
  }
  db.exec('DROP TABLE progress; ALTER TABLE progress_v2 RENAME TO progress;');
}

/** Schema migrations, applied in order; `PRAGMA user_version` = number of migrations applied. */
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
];

export function openDb(dbPath: string): DatabaseSync {
  if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number } | undefined;
  const version = row?.user_version ?? 0;
  for (let v = version; v < MIGRATIONS.length; v++) {
    db.exec('BEGIN');
    try {
      const m = MIGRATIONS[v];
      if (typeof m === 'string') db.exec(m);
      else m(db);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  return db;
}

/** Run `fn` inside a transaction (DatabaseSync is synchronous, so no interleaving within one process). */
export function tx<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
