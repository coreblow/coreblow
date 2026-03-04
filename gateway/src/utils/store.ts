/**
 * src/utils/store.ts
 * SQLite store for persistent state (sessions, cron, auth)
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { createChildLogger } from './logger.js';

const log = createChildLogger('store');

let db: Database.Database | null = null;

export function getStore(homeDir: string): Database.Database {
    if (db) return db;

    const stateDir = path.join(homeDir, 'state');
    fs.mkdirSync(stateDir, { recursive: true });

    const dbPath = path.join(stateDir, 'coreblow.db');
    db = new Database(dbPath);

    // Enable WAL mode for better concurrent reads
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    initSchema(db);
    log.info({ path: dbPath }, 'SQLite store initialized');

    return db;
}

function initSchema(db: Database.Database) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS auth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      last_used_at TEXT
    );

    CREATE TABLE IF NOT EXISTS cron_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      schedule TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      message TEXT NOT NULL,
      enabled INTEGER DEFAULT 1,
      last_run_at TEXT,
      next_run_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

export function closeStore() {
    if (db) {
        db.close();
        db = null;
        log.info('SQLite store closed');
    }
}
