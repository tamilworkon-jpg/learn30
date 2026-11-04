// @vitest-environment node
// Learn30 W3 (spec 002 contracts/progress-api-v2.md): progress per (user, course), migration of
// pre-Learn30 databases, the summary endpoint and the per-page bootstrap.
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultProgress } from '../../server/api';
import { loadCourseIds } from '../../server/courses';
import { openDb } from '../../server/db';
import { startHarness, type Harness, type Res } from './server-harness';

const AWS = 'aws-ai-practitioner';
const DEMO = 'demo-course';

const bootstrapOf = (r: Res) => {
  const m = /<script type="application\/json" id="aip-bootstrap">(.*?)<\/script>/s.exec(r.text);
  return JSON.parse(m![1]) as Record<string, unknown>;
};

let h: Harness;
let cookie: string;
beforeAll(async () => {
  h = await startHarness({ courseIds: [AWS, DEMO] });
  for (const rel of [`course/${DEMO}/day/01/index.html`, `course/${AWS}/index.html`]) {
    const f = join(h.root, 'dist', rel);
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, '<!doctype html><html><head><title>x</title></head><body></body></html>');
  }
  cookie = (await h.signup('multi', 'password123')).cookie;
});
afterAll(async () => {
  await h.close();
});

describe('L030 progress API v2', () => {
  it('each course has its own progress; /api/progress is the first course', async () => {
    const aws = { ...defaultProgress(h.clock.t), badges: ['week-1'] };
    const demo = { ...defaultProgress(h.clock.t), badges: ['streak-7'], days: { '2': { status: 'completed', sectionsViewed: [] } } };
    expect((await h.api('PUT', `/api/courses/${AWS}/progress`, aws, cookie)).status).toBe(204);
    expect((await h.api('PUT', `/api/courses/${DEMO}/progress`, demo, cookie)).status).toBe(204);
    expect((await h.api('GET', `/api/courses/${AWS}/progress`, undefined, cookie)).json()).toEqual(aws);
    expect((await h.api('GET', `/api/courses/${DEMO}/progress`, undefined, cookie)).json()).toEqual(demo);
    expect((await h.api('GET', '/api/progress', undefined, cookie)).json()).toEqual(aws);
  });

  it('unknown course → 404; signed out → 401; CSRF still required', async () => {
    expect((await h.api('GET', '/api/courses/nope/progress', undefined, cookie)).status).toBe(404);
    expect((await h.api('PUT', '/api/courses/nope/progress', defaultProgress(h.clock.t), cookie)).status).toBe(404);
    expect((await h.api('GET', `/api/courses/${DEMO}/progress`)).status).toBe(401);
    const noCsrf = await h.req('PUT', `/api/courses/${DEMO}/progress`, { body: defaultProgress(h.clock.t), cookie, headers: { 'Content-Type': 'application/json' } });
    expect(noCsrf.status).toBe(403);
  });

  it('a course opened for the first time gets a stable start date (created on first read)', async () => {
    const fresh = (await h.signup('fresh_one', 'password123')).cookie;
    const first = (await h.api('GET', `/api/courses/${DEMO}/progress`, undefined, fresh)).json() as { startedAt: string };
    h.clock.t += 3 * 86_400_000;
    const again = (await h.api('GET', `/api/courses/${DEMO}/progress`, undefined, fresh)).json() as { startedAt: string };
    expect(again.startedAt).toBe(first.startedAt);
  });

  it('GET /api/progress/summary: completed days, start and position per course', async () => {
    const s = (await h.api('GET', '/api/progress/summary', undefined, cookie)).json() as { courses: Record<string, { completed: number; startedAt: string }> };
    expect(Object.keys(s.courses).sort()).toEqual([AWS, DEMO]);
    expect(s.courses[DEMO].completed).toBe(1);
    expect(s.courses[AWS].completed).toBe(0);
    expect(typeof s.courses[AWS].startedAt).toBe('string');
    expect((await h.api('GET', '/api/progress/summary')).status).toBe(401);
  });

  it('/api/ui accepts the account theme and course-scoped slide keys', async () => {
    const ui = { theme: 'dark', slides: { [`${DEMO}:2`]: { sectionId: 'recap', block: 0 }, '3': { sectionId: 'quiz', block: 1 } } };
    expect((await h.api('PUT', '/api/ui', ui, cookie)).status).toBe(204);
    expect((await h.api('GET', '/api/ui', undefined, cookie)).json()).toEqual(ui);
    expect((await h.api('PUT', '/api/ui', { theme: 'blue' }, cookie)).status).toBe(400);
  });

  it('bootstrap: course pages carry that course; global pages carry the summary', async () => {
    const onCourse = bootstrapOf(await h.req('GET', `/course/${DEMO}/day/01`, { cookie }));
    expect((onCourse.course as { id: string }).id).toBe(DEMO);
    expect(((onCourse.course as { progress: { badges: string[] } }).progress).badges).toEqual(['streak-7']);
    expect(onCourse.summary).toBeNull();
    const global = bootstrapOf(await h.req('GET', '/settings', { cookie }));
    expect(global.course).toBeNull();
    expect(Object.keys((global.summary as { courses: object }).courses)).toContain(DEMO);
    expect((global.progress as { badges: string[] }).badges).toEqual(['week-1']); // first course, for older readers
  });

  it('deleting the account removes every course row', async () => {
    const c = (await h.signup('leaver', 'password123')).cookie;
    await h.api('PUT', `/api/courses/${DEMO}/progress`, defaultProgress(h.clock.t), c);
    expect((await h.api('DELETE', '/api/me', { password: 'password123' }, c)).status).toBe(204);
    const db = new DatabaseSync(h.dbPath);
    const n = (db.prepare("SELECT COUNT(*) AS n FROM progress p JOIN users u ON u.id = p.user_id WHERE u.username = 'leaver'").get() as { n: number }).n;
    const orphans = (db.prepare('SELECT COUNT(*) AS n FROM progress WHERE user_id NOT IN (SELECT id FROM users)').get() as { n: number }).n;
    db.close();
    expect(n).toBe(0);
    expect(orphans).toBe(0);
  });
});

describe('L030 migration of a pre-Learn30 database', () => {
  it('moves each progress row to the first course and the theme to ui_state; idempotent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aip-migrate-'));
    const path = join(dir, 'old.db');
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL, pass_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL, expires_at TEXT NOT NULL);
      CREATE INDEX sessions_user ON sessions(user_id);
      CREATE TABLE progress (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, doc TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE ui_state (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, doc TEXT NOT NULL, updated_at TEXT NOT NULL);
      PRAGMA user_version = 1;`);
    const doc = { ...defaultProgress(Date.parse('2026-10-20T08:00:00Z')), settings: { theme: 'dark' }, days: { '1': { status: 'completed', sectionsViewed: [] } } };
    old.prepare("INSERT INTO users VALUES (1, 'early', 'Early', 'x', '2026-10-20T08:00:00Z'), (2, 'other', 'Other', 'x', '2026-10-20T08:00:00Z')").run();
    old.prepare("INSERT INTO progress VALUES (1, ?, '2026-10-21T00:00:00Z'), (2, ?, '2026-10-21T00:00:00Z')").run(JSON.stringify(doc), JSON.stringify({ ...doc, settings: {} }));
    old.prepare("INSERT INTO ui_state VALUES (2, '{\"lessonView\":\"full\"}', '2026-10-21T00:00:00Z')").run();
    old.close();

    const db = openDb(path);
    const rows = db.prepare('SELECT user_id, course_id, doc FROM progress ORDER BY user_id').all() as { user_id: number; course_id: string; doc: string }[];
    expect(rows.map((r) => [r.user_id, r.course_id])).toEqual([
      [1, AWS],
      [2, AWS],
    ]);
    expect(JSON.parse(rows[0].doc).days['1'].status).toBe('completed');
    const ui = (id: number) => JSON.parse((db.prepare('SELECT doc FROM ui_state WHERE user_id = ?').get(id) as { doc: string }).doc);
    expect(ui(1)).toEqual({ theme: 'dark' });
    expect(ui(2)).toEqual({ lessonView: 'full' });
    db.close();
    // Re-opening does not migrate again.
    const again = openDb(path);
    expect((again.prepare('SELECT COUNT(*) AS n FROM progress').get() as { n: number }).n).toBe(2);
    expect((again.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(2);
    again.close();
  });
});

describe('course registry for the server', () => {
  it('reads src/data/courses.yaml (first course always known); fixtures only with AIP_FIXTURE_COURSES=1', () => {
    expect(loadCourseIds({})).toContain(AWS);
    expect(loadCourseIds({})).not.toContain(DEMO);
  });
});
