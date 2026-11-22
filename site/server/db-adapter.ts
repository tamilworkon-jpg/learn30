// Async database interface shared by the local SQLite file (node:sqlite) and a hosted libSQL / Turso database
// (Vercel and other serverless hosts, where the local disk does not persist).
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';

export type SqlArg = string | number | bigint | null;

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

/** Statements usable both at top level and inside a transaction. */
export interface DbOps {
  get<T>(sql: string, ...args: SqlArg[]): Promise<T | undefined>;
  all<T>(sql: string, ...args: SqlArg[]): Promise<T[]>;
  run(sql: string, ...args: SqlArg[]): Promise<RunResult>;
  /** Several `;`-separated statements without arguments. */
  exec(sql: string): Promise<void>;
}

export interface Db extends DbOps {
  /** Run `fn` in a write transaction (committed when it resolves, rolled back when it throws). */
  transaction<T>(fn: (tx: DbOps) => Promise<T>): Promise<T>;
  /** Schema version (number of migrations applied). */
  getVersion(tx: DbOps): Promise<number>;
  setVersion(tx: DbOps, v: number): Promise<void>;
  close(): Promise<void>;
  readonly kind: 'sqlite' | 'libsql';
}

export interface DbSpec {
  /** Local SQLite file path (or ':memory:'). */
  path?: string;
  /** libSQL URL: libsql://…, https://… (Turso) or file:… (tests). Takes precedence over `path`. */
  url?: string;
  authToken?: string;
}

// ---------- node:sqlite (local file) ----------
async function openSqlite(path: string): Promise<Db> {
  const { DatabaseSync } = await import('node:sqlite');
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db: DatabaseSync = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

  const ops: DbOps = {
    get: async <T>(sql: string, ...args: SqlArg[]) => db.prepare(sql).get(...args) as T | undefined,
    all: async <T>(sql: string, ...args: SqlArg[]) => db.prepare(sql).all(...args) as T[],
    run: async (sql, ...args) => {
      const r = db.prepare(sql).run(...args);
      return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
    },
    exec: async (sql) => {
      db.exec(sql);
    },
  };

  // One connection shared by every request: while a transaction awaits, other statements must wait for it,
  // otherwise they would run inside it (and be rolled back with it).
  let active: Promise<unknown> | null = null;
  const idle = async () => {
    while (active) await active.catch(() => {});
  };
  const queued =
    <A extends unknown[], R>(fn: (...a: A) => Promise<R>) =>
    async (...a: A): Promise<R> => {
      await idle();
      return fn(...a);
    };

  return {
    kind: 'sqlite',
    get: queued(ops.get) as DbOps['get'],
    all: queued(ops.all) as DbOps['all'],
    run: queued(ops.run),
    exec: queued(ops.exec),
    async transaction<T>(fn: (tx: DbOps) => Promise<T>): Promise<T> {
      await idle();
      const p = (async () => {
        db.exec('BEGIN IMMEDIATE');
        try {
          const r = await fn(ops);
          db.exec('COMMIT');
          return r;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      })();
      active = p;
      try {
        return await p;
      } finally {
        if (active === p) active = null;
      }
    },
    async getVersion(tx) {
      return ((await tx.get<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0) as number;
    },
    async setVersion(tx, v) {
      await tx.exec(`PRAGMA user_version = ${Math.floor(v)}`);
    },
    async close() {
      await idle();
      db.close();
    },
  };
}

// ---------- libSQL / Turso ----------
interface LibsqlResult {
  columns: string[];
  rows: ArrayLike<unknown>[];
  rowsAffected: number;
  lastInsertRowid: bigint | undefined;
}
interface LibsqlExecutor {
  execute(stmt: { sql: string; args: SqlArg[] }): Promise<LibsqlResult>;
  executeMultiple(sql: string): Promise<void>;
}
interface LibsqlTx extends LibsqlExecutor {
  commit(): Promise<void>;
  rollback(): Promise<void>;
  close(): void;
}
interface LibsqlClient extends LibsqlExecutor {
  transaction(mode: 'write'): Promise<LibsqlTx>;
  close(): void;
}

function toObjects<T>(r: LibsqlResult): T[] {
  return r.rows.map((row) => {
    const o: Record<string, unknown> = {};
    r.columns.forEach((c, i) => (o[c] = row[i]));
    return o as T;
  });
}

function libsqlOps(ex: LibsqlExecutor): DbOps {
  return {
    get: async <T>(sql: string, ...args: SqlArg[]) => toObjects<T>(await ex.execute({ sql, args }))[0],
    all: async <T>(sql: string, ...args: SqlArg[]) => toObjects<T>(await ex.execute({ sql, args })),
    run: async (sql, ...args) => {
      const r = await ex.execute({ sql, args });
      return { changes: r.rowsAffected, lastInsertRowid: Number(r.lastInsertRowid ?? 0) };
    },
    exec: (sql) => ex.executeMultiple(sql),
  };
}

async function openLibsql(url: string, authToken?: string): Promise<Db> {
  type Mod = { createClient(c: { url: string; authToken?: string; intMode?: string }): LibsqlClient };
  const local = url.startsWith('file:');
  // The web build is pure JS over HTTP, so serverless bundles need no native binaries. `file:` URLs (tests, local
  // experiments) need the Node build, loaded by a non-literal specifier so bundlers leave it out.
  const nodeBuild = '@libsql/client';
  const mod = (local ? await import(/* @vite-ignore */ nodeBuild) : await import('@libsql/client/web')) as Mod;
  // libsql://host → https://host: stateless HTTP requests suit short-lived serverless instances (no WebSocket).
  const client = mod.createClient({ url: url.replace(/^libsql:\/\//, 'https://'), authToken, intMode: 'number' });
  if (local) await client.executeMultiple('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  await client.execute({ sql: 'PRAGMA foreign_keys = ON', args: [] });
  const ops = libsqlOps(client);
  return {
    kind: 'libsql',
    ...ops,
    async transaction<T>(fn: (tx: DbOps) => Promise<T>): Promise<T> {
      const t = await client.transaction('write');
      try {
        const r = await fn(libsqlOps(t));
        await t.commit();
        return r;
      } catch (e) {
        await t.rollback().catch(() => {});
        throw e;
      } finally {
        t.close();
      }
    },
    // PRAGMA user_version is not reliable over remote connections: keep the version in a table.
    async getVersion(tx) {
      await tx.exec('CREATE TABLE IF NOT EXISTS schema_meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)');
      return (await tx.get<{ v: number }>("SELECT v FROM schema_meta WHERE k = 'version'"))?.v ?? 0;
    },
    async setVersion(tx, v) {
      await tx.run("INSERT INTO schema_meta (k, v) VALUES ('version', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", v);
    },
    async close() {
      client.close();
    },
  };
}

export function openAdapter(spec: DbSpec): Promise<Db> {
  if (spec.url) return openLibsql(spec.url, spec.authToken);
  if (!spec.path) throw new Error('No database configured: set AIP_DB (local file) or AIP_DB_URL (libSQL / Turso).');
  return openSqlite(spec.path);
}
