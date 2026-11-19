import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import type {
  SessionSurface,
  UnifiedSessionMessage,
  UnifiedSessionRecord,
} from "./unified-session-store.js";

type DatabaseSyncType = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  };
  close(): void;
};

type DatabaseSyncConstructor = new (filename: string) => DatabaseSyncType;

let cachedDatabaseClass: DatabaseSyncConstructor | null | undefined = undefined;
const activeDatabases = new Map<string, DatabaseSyncType>();
const migratedPaths = new Set<string>();

/**
 * Checks if node:sqlite DatabaseSync is available in the current runtime.
 */
export function isSqliteAvailable(): boolean {
  return getDatabaseSyncConstructor() !== null;
}

/**
 * Safely loads the node:sqlite DatabaseSync constructor via createRequire.
 */
function getDatabaseSyncConstructor(): DatabaseSyncConstructor | null {
  if (cachedDatabaseClass !== undefined) {
    return cachedDatabaseClass;
  }
  try {
    const req = createRequire(import.meta.url);
    const sqliteModule = req("node:sqlite") as { DatabaseSync?: DatabaseSyncConstructor };
    if (sqliteModule && typeof sqliteModule.DatabaseSync === "function") {
      cachedDatabaseClass = sqliteModule.DatabaseSync;
      return cachedDatabaseClass;
    }
  } catch {
    // node:sqlite is not available
  }
  cachedDatabaseClass = null;
  return null;
}

/**
 * Resolves the SQLite database path for session storage.
 * Default: ~/.coreblow/sessions/state.db
 */
export function resolveSqliteSessionStorePath(customPath?: string): string {
  if (customPath && customPath.trim().length > 0) {
    const raw = customPath.trim();
    let resolved: string;
    if (raw.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      resolved = path.resolve(home, raw.slice(1).replace(/^\/+/, ""));
    } else {
      resolved = path.resolve(raw);
    }
    if (resolved.endsWith(".db")) {
      return resolved;
    }
    return path.join(path.dirname(resolved), "state.db");
  }

  const envSqlitePath = process.env.COREBLOW_SQLITE_SESSION_STORE_PATH?.trim();
  if (envSqlitePath) {
    if (envSqlitePath.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      return path.resolve(home, envSqlitePath.slice(1).replace(/^\/+/, ""));
    }
    return path.resolve(envSqlitePath);
  }

  const envSessionPath = process.env.COREBLOW_SESSION_STORE_PATH?.trim();
  if (envSessionPath) {
    let resolved: string;
    if (envSessionPath.startsWith("~")) {
      const home = process.env.HOME ?? os.homedir();
      resolved = path.resolve(home, envSessionPath.slice(1).replace(/^\/+/, ""));
    } else {
      resolved = path.resolve(envSessionPath);
    }
    if (resolved.endsWith(".db")) {
      return resolved;
    }
    return path.join(path.dirname(resolved), "state.db");
  }

  const stateDir = resolveStateDir();
  return path.join(stateDir, "sessions", "state.db");
}

/**
 * Obtains or creates an initialized SQLite session database with WAL mode and FTS5.
 */
export function getOrCreateSqliteDb(customPath?: string): DatabaseSyncType | null {
  const DatabaseClass = getDatabaseSyncConstructor();
  if (!DatabaseClass) {
    return null;
  }

  const dbPath = resolveSqliteSessionStorePath(customPath);
  if (activeDatabases.has(dbPath)) {
    return activeDatabases.get(dbPath)!;
  }

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new DatabaseClass(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      cwd TEXT,
      execution_profile TEXT,
      model TEXT,
      surface TEXT,
      messages_json TEXT
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
      session_id UNINDEXED,
      title,
      content,
      tokenize='porter unicode61'
    );
  `);

  activeDatabases.set(dbPath, db);

  // Check if legacy migration is needed once per DB path
  if (!migratedPaths.has(dbPath)) {
    migratedPaths.add(dbPath);
    try {
      const row = db.prepare("SELECT count(*) as cnt FROM sessions").get() as { cnt?: number };
      if (!row || Number(row.cnt) === 0) {
        let legacyJsonPath = path.join(path.dirname(dbPath), "sessions-store.json");
        if (customPath && customPath.trim().endsWith(".json")) {
          const raw = customPath.trim();
          const customResolved = raw.startsWith("~")
            ? path.resolve(process.env.HOME ?? os.homedir(), raw.slice(1).replace(/^\/+/, ""))
            : path.resolve(raw);
          if (fs.existsSync(customResolved)) {
            legacyJsonPath = customResolved;
          }
        }
        if (fs.existsSync(legacyJsonPath)) {
          migrateLegacyJsonToSqlite(legacyJsonPath, db);
        }
      }
    } catch {
      // Ignore migration errors on corrupted legacy file
    }
  }

  return db;
}

/**
 * Closes one or all open SQLite session databases.
 */
export function closeSqliteSessionStore(customPath?: string): void {
  if (customPath) {
    const dbPath = resolveSqliteSessionStorePath(customPath);
    migratedPaths.delete(dbPath);
    const db = activeDatabases.get(dbPath);
    if (db) {
      try {
        db.close();
      } catch {}
      activeDatabases.delete(dbPath);
    }
  } else {
    migratedPaths.clear();
    for (const [p, db] of activeDatabases.entries()) {
      try {
        db.close();
      } catch {}
      activeDatabases.delete(p);
    }
  }
}

/**
 * Migrates a legacy sessions-store.json file into the SQLite database.
 */
export function migrateLegacyJsonToSqlite(jsonPath: string, db?: DatabaseSyncType): number {
  if (!fs.existsSync(jsonPath)) return 0;
  const targetDb = db ?? getOrCreateSqliteDb(jsonPath);
  if (!targetDb) return 0;

  try {
    const raw = fs.readFileSync(jsonPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.sessions !== "object") return 0;

    const insertSession = targetDb.prepare(`
      INSERT OR REPLACE INTO sessions (id, title, created_at, updated_at, cwd, execution_profile, model, surface, messages_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const deleteFts = targetDb.prepare(`
      DELETE FROM sessions_fts WHERE session_id = ?
    `);
    const insertFts = targetDb.prepare(`
      INSERT INTO sessions_fts (session_id, title, content)
      VALUES (?, ?, ?)
    `);

    let count = 0;
    for (const s of Object.values(parsed.sessions) as UnifiedSessionRecord[]) {
      if (!s || !s.id) continue;
      insertSession.run(
        s.id,
        s.title || "New Chat",
        s.createdAt || Date.now(),
        s.updatedAt || Date.now(),
        s.cwd ?? null,
        s.executionProfile ?? null,
        s.model ?? null,
        s.surface ?? "desktop",
        JSON.stringify(s.messages ?? []),
      );
      deleteFts.run(s.id);
      const textContent = Array.isArray(s.messages)
        ? s.messages.map((m) => m.content ?? "").join("\n")
        : "";
      insertFts.run(s.id, s.title || "", textContent);
      count++;
    }
    return count;
  } catch {
    return 0;
  }
}

interface SessionRow {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  cwd: string | null;
  execution_profile: string | null;
  model: string | null;
  surface: string | null;
  messages_json: string | null;
}

function rowToRecord(row: SessionRow): UnifiedSessionRecord {
  let messages: UnifiedSessionMessage[] = [];
  if (row.messages_json) {
    try {
      messages = JSON.parse(row.messages_json);
    } catch {
      messages = [];
    }
  }

  return {
    id: row.id,
    title: row.title,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    cwd: row.cwd ?? undefined,
    executionProfile: row.execution_profile ?? undefined,
    model: row.model ?? undefined,
    surface: (row.surface as SessionSurface) || "desktop",
    messages,
  };
}

/**
 * Lists sessions from the SQLite store, optionally filtered by FTS5 query or substring match.
 */
export function listSqliteSessions(options?: {
  query?: string;
  limit?: number;
  storePath?: string;
}): UnifiedSessionRecord[] {
  const db = getOrCreateSqliteDb(options?.storePath);
  if (!db) return [];

  const rawQuery = options?.query?.trim();

  if (!rawQuery) {
    const limit = typeof options?.limit === "number" && options.limit > 0 ? options.limit : 200;
    const stmt = db.prepare(`SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?`);
    const rows = stmt.all(limit) as SessionRow[];
    return rows.map(rowToRecord);
  }

  // Search using FTS5 + exact ID / Title substring
  const matchingIds = new Set<string>();

  // 1. Direct ID / Title match
  try {
    const directRows = db.prepare(`
      SELECT id FROM sessions WHERE id LIKE ? OR title LIKE ?
    `).all(`%${rawQuery}%`, `%${rawQuery}%`) as Array<{ id: string }>;
    for (const r of directRows) {
      matchingIds.add(r.id);
    }
  } catch {}

  // 2. FTS5 query across title and message content
  try {
    const tokens = rawQuery.match(/[\p{L}\p{N}_-]+/gu);
    if (tokens && tokens.length > 0) {
      const ftsExpr = tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(" AND ");
      const ftsRows = db.prepare(`
        SELECT session_id FROM sessions_fts WHERE sessions_fts MATCH ?
      `).all(ftsExpr) as Array<{ session_id: string }>;
      for (const r of ftsRows) {
        matchingIds.add(r.session_id);
      }
    }
  } catch {
    // If FTS fails, fall back to LIKE on messages_json
    try {
      const fallbackRows = db.prepare(`
        SELECT id FROM sessions WHERE messages_json LIKE ?
      `).all(`%${rawQuery}%`) as Array<{ id: string }>;
      for (const r of fallbackRows) {
        matchingIds.add(r.id);
      }
    } catch {}
  }

  if (matchingIds.size === 0) {
    return [];
  }

  const idsArray = Array.from(matchingIds);
  // Fetch matching records
  const placeholders = idsArray.map(() => "?").join(",");
  const rows = db.prepare(`
    SELECT * FROM sessions WHERE id IN (${placeholders}) ORDER BY updated_at DESC
  `).all(...idsArray) as SessionRow[];

  let result = rows.map(rowToRecord);
  if (typeof options?.limit === "number" && options.limit > 0) {
    result = result.slice(0, options.limit);
  }
  return result;
}

/**
 * Retrieves a single session record by ID.
 */
export function getSqliteSession(
  id: string,
  storePath?: string,
): UnifiedSessionRecord | undefined {
  const targetId = id.trim();
  if (!targetId) return undefined;

  const db = getOrCreateSqliteDb(storePath);
  if (!db) return undefined;

  const exactRow = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(targetId) as SessionRow | undefined;
  if (exactRow) {
    return rowToRecord(exactRow);
  }

  const lowerRow = db.prepare(`SELECT * FROM sessions WHERE LOWER(id) = LOWER(?) LIMIT 1`).get(targetId) as SessionRow | undefined;
  if (lowerRow) {
    return rowToRecord(lowerRow);
  }

  return undefined;
}

/**
 * Upserts a session record into SQLite and updates the FTS5 index.
 */
export function upsertSqliteSession(
  session: Partial<UnifiedSessionRecord> & { id: string },
  storePath?: string,
): UnifiedSessionRecord {
  const db = getOrCreateSqliteDb(storePath);
  if (!db) {
    throw new Error("SQLite session database unavailable");
  }

  const id = session.id.trim();
  const existing = getSqliteSession(id, storePath);
  const now = Date.now();

  const title =
    session.title?.trim() ||
    existing?.title ||
    session.messages?.[0]?.content?.slice(0, 48) ||
    "New Chat";

  const record: UnifiedSessionRecord = {
    id,
    title,
    createdAt: existing?.createdAt ?? session.createdAt ?? now,
    updatedAt: session.updatedAt ?? now,
    cwd: session.cwd ?? existing?.cwd,
    executionProfile: session.executionProfile ?? existing?.executionProfile,
    model: session.model ?? existing?.model,
    surface: session.surface ?? existing?.surface ?? "desktop",
    messages: Array.isArray(session.messages) ? [...session.messages] : (existing?.messages ?? []),
  };

  db.prepare(`
    INSERT OR REPLACE INTO sessions (id, title, created_at, updated_at, cwd, execution_profile, model, surface, messages_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.id,
    record.title,
    record.createdAt,
    record.updatedAt,
    record.cwd ?? null,
    record.executionProfile ?? null,
    record.model ?? null,
    record.surface,
    JSON.stringify(record.messages),
  );

  // Update FTS5
  db.prepare(`DELETE FROM sessions_fts WHERE session_id = ?`).run(record.id);
  const textContent = record.messages.map((m) => m.content ?? "").join("\n");
  db.prepare(`INSERT INTO sessions_fts (session_id, title, content) VALUES (?, ?, ?)`).run(
    record.id,
    record.title,
    textContent,
  );

  return record;
}

/**
 * Appends a user/assistant turn to a session record in SQLite.
 */
export function appendTurnToSqliteSession(params: {
  sessionId?: string;
  prompt: string;
  reply: string;
  toolSteps?: string[];
  attachedFiles?: string[];
  surface?: SessionSurface;
  cwd?: string;
  executionProfile?: string;
  model?: string;
  storePath?: string;
}): UnifiedSessionRecord {
  const id =
    params.sessionId?.trim() ||
    `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const existing = getSqliteSession(id, params.storePath);
  const now = Date.now();

  // Deduplicate if the last turn already matches this exact prompt and reply within 10 seconds
  if (existing?.messages && existing.messages.length >= 2) {
    const lastUser = existing.messages[existing.messages.length - 2];
    const lastAssistant = existing.messages[existing.messages.length - 1];
    if (
      lastUser.role === "user" &&
      lastUser.content === params.prompt &&
      lastAssistant.role === "assistant" &&
      lastAssistant.content === params.reply &&
      Math.abs(now - lastAssistant.createdAt) < 10000
    ) {
      return existing;
    }
  }

  const userMsgId = `msg_${now}_user_${Math.random().toString(36).slice(2, 6)}`;
  const assistantMsgId = `msg_${now + 1}_assistant_${Math.random().toString(36).slice(2, 6)}`;

  const userMessage: UnifiedSessionMessage = {
    id: userMsgId,
    role: "user",
    content: params.prompt,
    createdAt: now,
    attachedFiles: params.attachedFiles && params.attachedFiles.length > 0 ? [...params.attachedFiles] : undefined,
  };

  const assistantMessage: UnifiedSessionMessage = {
    id: assistantMsgId,
    role: "assistant",
    content: params.reply,
    createdAt: now + 1,
    toolSteps: params.toolSteps && params.toolSteps.length > 0 ? [...params.toolSteps] : undefined,
  };

  const title =
    existing?.title ||
    (params.prompt.length > 48
      ? `${params.prompt.slice(0, 48).trim()}...`
      : params.prompt.trim()) ||
    "New Chat";

  const updatedMessages = existing?.messages ? [...existing.messages] : [];
  updatedMessages.push(userMessage, assistantMessage);

  const record: UnifiedSessionRecord = {
    id,
    title,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now + 1,
    cwd: params.cwd ?? existing?.cwd,
    executionProfile: params.executionProfile ?? existing?.executionProfile,
    model: params.model ?? existing?.model,
    surface: params.surface ?? existing?.surface ?? "desktop",
    messages: updatedMessages,
  };

  return upsertSqliteSession(record, params.storePath);
}

/**
 * Deletes a session by ID from SQLite and removes its FTS5 index.
 */
export function deleteSqliteSession(id: string, storePath?: string): boolean {
  const targetId = id.trim();
  if (!targetId) return false;

  const db = getOrCreateSqliteDb(storePath);
  if (!db) return false;

  const existing = getSqliteSession(targetId, storePath);
  if (!existing) return false;

  db.prepare(`DELETE FROM sessions WHERE id = ?`).run(existing.id);
  db.prepare(`DELETE FROM sessions_fts WHERE session_id = ?`).run(existing.id);
  return true;
}

/**
 * Clears all sessions from the SQLite store.
 */
export function clearSqliteSessions(storePath?: string): void {
  const db = getOrCreateSqliteDb(storePath);
  if (!db) return;
  db.exec(`
    DELETE FROM sessions;
    DELETE FROM sessions_fts;
  `);
}
