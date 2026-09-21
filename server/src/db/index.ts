import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { SCHEMA_SQL, SCHEMA_VERSION } from './schema.js';

export type SqlParam = string | number | bigint | null | Uint8Array;
type Row = Record<string, unknown>;

let db: DatabaseSync | null = null;

/** Convert JS values into what node:sqlite can bind (no booleans / undefined). */
function normalise(params: unknown[]): SqlParam[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (p instanceof Date) return p.toISOString();
    if (typeof p === 'object' && p !== null && !(p instanceof Uint8Array)) return JSON.stringify(p);
    return p as SqlParam;
  });
}

export function getDb(): DatabaseSync {
  if (db) return db;
  const file = config.databasePath;
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (config.resetDbOnBoot && fs.existsSync(file)) fs.rmSync(file);
  }
  db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  return db;
}

/** Replace the active connection (used by tests to get a fresh in-memory DB). */
export function resetDbConnection(): void {
  if (db) {
    try {
      db.close();
    } catch {
      /* ignore */
    }
  }
  db = null;
}

export function migrate(): { applied: number[] } {
  const d = getDb();
  d.exec(SCHEMA_SQL);
  const applied: number[] = [];
  const has = d.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(SCHEMA_VERSION);
  if (!has) {
    d.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(
      SCHEMA_VERSION,
      new Date().toISOString(),
    );
    applied.push(SCHEMA_VERSION);
  }
  return { applied };
}

export const q = {
  all<T = Row>(sql: string, ...params: unknown[]): T[] {
    return getDb().prepare(sql).all(...normalise(params)) as T[];
  },
  get<T = Row>(sql: string, ...params: unknown[]): T | undefined {
    return getDb().prepare(sql).get(...normalise(params)) as T | undefined;
  },
  run(sql: string, ...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint } {
    return getDb().prepare(sql).run(...normalise(params));
  },
  exec(sql: string): void {
    getDb().exec(sql);
  },
  count(sql: string, ...params: unknown[]): number {
    const row = getDb().prepare(sql).get(...normalise(params)) as Row | undefined;
    if (!row) return 0;
    const first = Object.values(row)[0];
    return Number(first ?? 0);
  },
};

/** Run `fn` inside a transaction; rolls back on throw. Nested calls join the outer transaction. */
let txDepth = 0;
export function tx<T>(fn: () => T): T {
  const d = getDb();
  if (txDepth > 0) {
    txDepth++;
    try {
      return fn();
    } finally {
      txDepth--;
    }
  }
  d.exec('BEGIN');
  txDepth++;
  try {
    const result = fn();
    d.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      d.exec('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    txDepth--;
  }
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}
