import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  appendTurnToUnifiedSession,
  deleteUnifiedSession,
  getUnifiedSession,
  listUnifiedSessions,
  loadUnifiedSessionStoreSync,
  resolveUnifiedSessionStorePath,
  saveUnifiedSessionStoreSync,
  upsertUnifiedSession,
} from "./unified-session-store.js";

describe("Unified Session Store", () => {
  let tempDir: string;
  let testStorePath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-session-store-test-"));
    testStorePath = path.join(tempDir, "sessions-store.json");
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("resolves default and custom store paths", () => {
    expect(resolveUnifiedSessionStorePath(testStorePath)).toBe(testStorePath);
    const defaultPath = resolveUnifiedSessionStorePath();
    expect(defaultPath).toMatch(/sessions[/\\]sessions-store\.json$/);
  });

  it("loads empty store when file does not exist", () => {
    const store = loadUnifiedSessionStoreSync(testStorePath);
    expect(store.version).toBe(1);
    expect(store.sessions).toEqual({});
  });

  it("saves and reloads session store atomically", () => {
    saveUnifiedSessionStoreSync(
      {
        version: 1,
        sessions: {
          s1: {
            id: "s1",
            title: "Test Session",
            createdAt: 1000,
            updatedAt: 2000,
            surface: "desktop",
            messages: [{ id: "m1", role: "user", content: "Hello", createdAt: 1000 }],
          },
        },
      },
      testStorePath,
    );

    const reloaded = loadUnifiedSessionStoreSync(testStorePath);
    expect(reloaded.sessions.s1.title).toBe("Test Session");
    expect(reloaded.sessions.s1.messages.length).toBe(1);
  });

  it("upserts and retrieves sessions", () => {
    const record = upsertUnifiedSession(
      {
        id: "sess_upsert_1",
        title: "Upserted Title",
        messages: [{ id: "m1", role: "user", content: "Test content", createdAt: Date.now() }],
        surface: "cli",
      },
      testStorePath,
    );
    expect(record.id).toBe("sess_upsert_1");
    expect(record.title).toBe("Upserted Title");

    const fetched = getUnifiedSession("sess_upsert_1", testStorePath);
    expect(fetched).toBeDefined();
    expect(fetched?.title).toBe("Upserted Title");
    expect(fetched?.surface).toBe("cli");

    // Case-insensitive lookup
    const lowerFetched = getUnifiedSession("SESS_UPSERT_1", testStorePath);
    expect(lowerFetched).toBeDefined();
    expect(lowerFetched?.id).toBe("sess_upsert_1");
  });

  it("appends user/assistant turns with automatic title derivation and idempotency", () => {
    const turn1 = appendTurnToUnifiedSession({
      sessionId: "sess_turn_1",
      prompt: "Can you analyze the repository architecture?",
      reply: "The repository uses a single-brain sovereign microkernel architecture.",
      toolSteps: ["✓ list_dir · src (12ms)"],
      surface: "desktop",
      cwd: "/Users/febrinanda/coreblow",
      storePath: testStorePath,
    });

    expect(turn1.id).toBe("sess_turn_1");
    expect(turn1.title).toBe("Can you analyze the repository architecture?");
    expect(turn1.messages.length).toBe(2);
    expect(turn1.messages[0].role).toBe("user");
    expect(turn1.messages[1].role).toBe("assistant");
    expect(turn1.messages[1].toolSteps).toEqual(["✓ list_dir · src (12ms)"]);

    // Idempotent duplicate protection within 10 seconds
    const turn1Dup = appendTurnToUnifiedSession({
      sessionId: "sess_turn_1",
      prompt: "Can you analyze the repository architecture?",
      reply: "The repository uses a single-brain sovereign microkernel architecture.",
      storePath: testStorePath,
    });
    expect(turn1Dup.messages.length).toBe(2);

    // Second distinct turn
    const turn2 = appendTurnToUnifiedSession({
      sessionId: "sess_turn_1",
      prompt: "How many tools are available?",
      reply: "There are 30 native tools available.",
      storePath: testStorePath,
    });
    expect(turn2.messages.length).toBe(4);
  });

  it("lists sessions with search queries and limits", () => {
    appendTurnToUnifiedSession({
      sessionId: "sess_search_1",
      prompt: "Explain TypeScript strict mode",
      reply: "TypeScript strict mode enables noImplicitAny, strictNullChecks, etc.",
      surface: "cli",
      storePath: testStorePath,
    });

    appendTurnToUnifiedSession({
      sessionId: "sess_search_2",
      prompt: "Run Flutter integration test on macOS",
      reply: "Use flutter test integration_test for Flutter apps.",
      surface: "desktop",
      storePath: testStorePath,
    });

    const all = listUnifiedSessions({ storePath: testStorePath });
    expect(all.length).toBe(2);

    const tsHits = listUnifiedSessions({ query: "strict", storePath: testStorePath });
    expect(tsHits.length).toBe(1);
    expect(tsHits[0].id).toBe("sess_search_1");

    const flutterHits = listUnifiedSessions({ query: "flutter", storePath: testStorePath });
    expect(flutterHits.length).toBe(1);
    expect(flutterHits[0].id).toBe("sess_search_2");

    const limited = listUnifiedSessions({ limit: 1, storePath: testStorePath });
    expect(limited.length).toBe(1);
  });

  it("deletes sessions safely", () => {
    appendTurnToUnifiedSession({
      sessionId: "sess_to_delete",
      prompt: "Temporary message",
      reply: "Temporary reply",
      storePath: testStorePath,
    });

    expect(getUnifiedSession("sess_to_delete", testStorePath)).toBeDefined();
    const deleted = deleteUnifiedSession("sess_to_delete", testStorePath);
    expect(deleted).toBe(true);
    expect(getUnifiedSession("sess_to_delete", testStorePath)).toBeUndefined();

    // Deleting again returns false
    const deletedAgain = deleteUnifiedSession("sess_to_delete", testStorePath);
    expect(deletedAgain).toBe(false);
  });
});
