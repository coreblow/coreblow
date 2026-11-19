import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendTurnToSqliteSession,
  clearSqliteSessions,
  closeSqliteSessionStore,
  deleteSqliteSession,
  getOrCreateSqliteDb,
  getSqliteSession,
  isSqliteAvailable,
  listSqliteSessions,
  migrateLegacyJsonToSqlite,
  resolveSqliteSessionStorePath,
  upsertSqliteSession,
} from "./sqlite-session-store.js";

describe("SQLite WAL + FTS5 Session Store", () => {
  let tempDir: string;
  let testDbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-sqlite-test-"));
    testDbPath = path.join(tempDir, "state.db");
  });

  afterEach(() => {
    closeSqliteSessionStore(testDbPath);
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("detects sqlite availability in Node 22+", () => {
    expect(isSqliteAvailable()).toBe(true);
  });

  it("resolves default and custom database paths", () => {
    expect(resolveSqliteSessionStorePath(testDbPath)).toBe(testDbPath);
    // Passing a json path targets state.db in dirname
    const jsonPath = path.join(tempDir, "sessions-store.json");
    expect(resolveSqliteSessionStorePath(jsonPath)).toBe(testDbPath);

    const defaultPath = resolveSqliteSessionStorePath();
    expect(defaultPath).toMatch(/sessions[/\\]state\.db$/);
  });

  it("initializes SQLite with WAL mode and schema tables", () => {
    const db = getOrCreateSqliteDb(testDbPath);
    expect(db).toBeDefined();

    // Verify tables exist
    const tables = (db!.prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'virtual')").all() as Array<{ name: string }>).map((t) => t.name);
    expect(tables).toContain("sessions");
    expect(tables).toContain("sessions_fts");
  });

  it("upserts and retrieves sessions", () => {
    const record = upsertSqliteSession(
      {
        id: "sess_sqlite_1",
        title: "Architecture Session",
        messages: [{ id: "m1", role: "user", content: "Explain WAL mode", createdAt: 1000 }],
        surface: "desktop",
      },
      testDbPath,
    );

    expect(record.id).toBe("sess_sqlite_1");
    expect(record.title).toBe("Architecture Session");

    const fetched = getSqliteSession("sess_sqlite_1", testDbPath);
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe("Architecture Session");
    expect(fetched?.messages.length).toBe(1);

    // Case-insensitive lookup
    const lower = getSqliteSession("SESS_SQLITE_1", testDbPath);
    expect(lower).toBeDefined();
    expect(lower?.id).toBe("sess_sqlite_1");
  });

  it("appends turns and indexes for FTS5 millisecond search", () => {
    const turn1 = appendTurnToSqliteSession({
      sessionId: "sess_fts_1",
      prompt: "How does CoreBlow achieve sovereign single-brain reasoning?",
      reply: "By unifying all channels into a local microkernel with zero third-party agent names.",
      toolSteps: ["✓ memory_wiki · query (5ms)"],
      storePath: testDbPath,
    });

    expect(turn1.id).toBe("sess_fts_1");
    expect(turn1.messages.length).toBe(2);

    // Duplicate within 10 seconds is idempotent
    const turn1Dup = appendTurnToSqliteSession({
      sessionId: "sess_fts_1",
      prompt: "How does CoreBlow achieve sovereign single-brain reasoning?",
      reply: "By unifying all channels into a local microkernel with zero third-party agent names.",
      storePath: testDbPath,
    });
    expect(turn1Dup.messages.length).toBe(2);

    // Search via FTS5
    const ftsResults = listSqliteSessions({ query: "sovereign", storePath: testDbPath });
    expect(ftsResults.length).toBe(1);
    expect(ftsResults[0].id).toBe("sess_fts_1");

    // Search via token in assistant reply
    const ftsReplyResults = listSqliteSessions({ query: "microkernel", storePath: testDbPath });
    expect(ftsReplyResults.length).toBe(1);
    expect(ftsReplyResults[0].id).toBe("sess_fts_1");
  });

  it("migrates legacy sessions-store.json automatically on first initialization", () => {
    const legacyJsonPath = path.join(tempDir, "sessions-store.json");
    fs.writeFileSync(
      legacyJsonPath,
      JSON.stringify(
        {
          version: 1,
          sessions: {
            migrated_1: {
              id: "migrated_1",
              title: "Migrated Session One",
              createdAt: 5000,
              updatedAt: 6000,
              surface: "cli",
              messages: [
                { id: "m1", role: "user", content: "Hello from legacy JSON file", createdAt: 5000 },
                { id: "m2", role: "assistant", content: "Welcome to SQLite WAL storage!", createdAt: 5001 },
              ],
            },
          },
        },
        null,
        2,
      ),
      "utf-8",
    );

    // When initializing the DB for this dir, it automatically migrates
    const sessions = listSqliteSessions({ storePath: testDbPath });
    expect(sessions.length).toBe(1);
    expect(sessions[0].id).toBe("migrated_1");
    expect(sessions[0].title).toBe("Migrated Session One");

    // Verify FTS5 search on migrated content
    const searchHits = listSqliteSessions({ query: "legacy", storePath: testDbPath });
    expect(searchHits.length).toBe(1);
    expect(searchHits[0].id).toBe("migrated_1");
  });

  it("deletes and clears sessions cleanly", () => {
    upsertSqliteSession(
      {
        id: "sess_delete_me",
        title: "Delete Me",
        messages: [{ id: "m1", role: "user", content: "Goodbye", createdAt: 100 }],
      },
      testDbPath,
    );

    expect(getSqliteSession("sess_delete_me", testDbPath)).toBeDefined();
    const deleted = deleteSqliteSession("sess_delete_me", testDbPath);
    expect(deleted).toBe(true);
    expect(getSqliteSession("sess_delete_me", testDbPath)).toBeUndefined();

    // Clear all
    upsertSqliteSession({ id: "s1", title: "S1" }, testDbPath);
    upsertSqliteSession({ id: "s2", title: "S2" }, testDbPath);
    expect(listSqliteSessions({ storePath: testDbPath }).length).toBe(2);

    clearSqliteSessions(testDbPath);
    expect(listSqliteSessions({ storePath: testDbPath }).length).toBe(0);
  });

  it("migrates from custom JSON store path with non-standard filename", () => {
    const customArchiveJson = path.join(tempDir, "custom-archive.json");
    fs.writeFileSync(
      customArchiveJson,
      JSON.stringify({
        version: 1,
        sessions: {
          custom_archived_1: {
            id: "custom_archived_1",
            title: "Archived Session",
            createdAt: 1000,
            updatedAt: 2000,
            surface: "channel",
            messages: [{ id: "m1", role: "user", content: "Archived prompt", createdAt: 1000 }],
          },
        },
      }),
      "utf-8",
    );

    const migrated = listSqliteSessions({ storePath: customArchiveJson });
    expect(migrated.length).toBe(1);
    expect(migrated[0].id).toBe("custom_archived_1");
  });

  it("resolves store path from COREBLOW_SESSION_STORE_PATH env var", () => {
    const originalSqliteEnv = process.env.COREBLOW_SQLITE_SESSION_STORE_PATH;
    const originalSessionEnv = process.env.COREBLOW_SESSION_STORE_PATH;
    try {
      delete process.env.COREBLOW_SQLITE_SESSION_STORE_PATH;
      process.env.COREBLOW_SESSION_STORE_PATH = "/tmp/test-env-sessions/store.json";
      const resolved = resolveSqliteSessionStorePath();
      expect(resolved).toBe("/tmp/test-env-sessions/state.db");
    } finally {
      if (originalSqliteEnv) process.env.COREBLOW_SQLITE_SESSION_STORE_PATH = originalSqliteEnv;
      else delete process.env.COREBLOW_SQLITE_SESSION_STORE_PATH;
      if (originalSessionEnv) process.env.COREBLOW_SESSION_STORE_PATH = originalSessionEnv;
      else delete process.env.COREBLOW_SESSION_STORE_PATH;
    }
  });
});
