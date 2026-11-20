import { describe, expect, it, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  forkSession,
  recordTerminalSessionBreadcrumb,
  renameSession,
  resolveLatestSessionForCwd,
  resolveSessionByIdOrQuery,
} from "./session-resume.js";
import {
  closeSqliteSessionStore,
  getOrCreateSqliteDb,
  upsertSqliteSession,
} from "../sessions/sqlite-session-store.js";

describe("session-resume", () => {
  let tempDir: string;
  let customDbPath: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-session-test-"));
    process.env.COREBLOW_STATE_DIR = tempDir;
    customDbPath = path.join(tempDir, "sessions", "sessions.db");
  });

  afterEach(() => {
    closeSqliteSessionStore(customDbPath);
    closeSqliteSessionStore();
    process.env = { ...originalEnv };
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it("records and reads terminal session breadcrumbs", () => {
    recordTerminalSessionBreadcrumb({
      sessionId: "session_test_123",
      cwd: tempDir,
    });

    const breadcrumbFile = path.join(tempDir, "terminal-sessions", "last-session.json");
    expect(fs.existsSync(breadcrumbFile)).toBe(true);
    const content = JSON.parse(fs.readFileSync(breadcrumbFile, "utf8"));
    expect(content.sessionId).toBe("session_test_123");
    expect(content.cwd).toBe(path.resolve(tempDir));
  });

  it("resolves the latest session matching cwd", () => {
    const db = getOrCreateSqliteDb(customDbPath);
    expect(db).toBeDefined();

    const otherDir = path.join(tempDir, "other");
    fs.mkdirSync(otherDir, { recursive: true });

    // Session 1 in otherDir
    upsertSqliteSession(
      {
        id: "sess_other",
        title: "Other Session",
        cwd: otherDir,
        updatedAt: 1000,
        messages: [{ id: "m1", role: "user", content: "Hi", createdAt: 1000 }],
      },
      customDbPath,
    );

    // Session 2 in tempDir (more recent for tempDir)
    upsertSqliteSession(
      {
        id: "sess_temp",
        title: "Temp Session",
        cwd: tempDir,
        updatedAt: 2000,
        messages: [{ id: "m2", role: "user", content: "Hello temp", createdAt: 2000 }],
      },
      customDbPath,
    );

    const latest = resolveLatestSessionForCwd(tempDir, customDbPath);
    expect(latest).toBeDefined();
    expect(latest?.id).toBe("sess_temp");
  });

  it("resolves session by exact ID or query search", () => {
    upsertSqliteSession(
      {
        id: "sess_search_42",
        title: "Refactor Database Schema",
        cwd: tempDir,
        messages: [
          { id: "m1", role: "user", content: "Let us optimize sqlite index", createdAt: 1000 },
        ],
      },
      customDbPath,
    );

    // 1. Direct ID
    const byId = resolveSessionByIdOrQuery("sess_search_42", tempDir, customDbPath);
    expect(byId).toBeDefined();
    expect(byId?.id).toBe("sess_search_42");

    // 2. Query search
    const byQuery = resolveSessionByIdOrQuery("Refactor Database", tempDir, customDbPath);
    expect(byQuery).toBeDefined();
    expect(byQuery?.id).toBe("sess_search_42");
  });

  it("forks a session into a new record with cloned messages and title suffix", () => {
    upsertSqliteSession(
      {
        id: "sess_original",
        title: "Original Work",
        cwd: tempDir,
        messages: [
          { id: "m1", role: "user", content: "Original prompt", createdAt: 1000 },
          { id: "m2", role: "assistant", content: "Original reply", createdAt: 1001 },
        ],
      },
      customDbPath,
    );

    const forked = forkSession("sess_original", undefined, customDbPath);
    expect(forked.id).not.toBe("sess_original");
    expect(forked.title).toBe("Original Work (fork)");
    expect(forked.messages.length).toBe(2);
    expect(forked.messages[0]?.content).toBe("Original prompt");
  });

  it("renames an existing session", () => {
    upsertSqliteSession(
      {
        id: "sess_to_rename",
        title: "Old Title",
        cwd: tempDir,
        messages: [],
      },
      customDbPath,
    );

    const renamed = renameSession("sess_to_rename", "Brand New Title", customDbPath);
    expect(renamed.id).toBe("sess_to_rename");
    expect(renamed.title).toBe("Brand New Title");
  });
});
