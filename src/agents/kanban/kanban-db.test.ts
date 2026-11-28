import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { KanbanBoardStore, resolveKanbanDbPath } from "./kanban-db.js";

describe("opt-in SQLite WAL Multi-Agent Kanban Board", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  it("enforces atomic CAS claim_lock under concurrent worker claims", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-kanban-test-"));
    tempDirs.push(dir);
    const env = { ...process.env, COREBLOW_STATE_DIR: dir };

    const ownerStore = new KanbanBoardStore({ boardSlug: "alpha", env });
    expect(ownerStore.getJournalMode()).toBe("wal");
    expect(fs.statSync(ownerStore.dbPath).mode & 0o777).toBe(0o600);

    const task = ownerStore.createTask({
      id: "task-race-1",
      title: "Ship Phase 5",
      coreflowContract: { gates: ["check", "test"] },
    });
    expect(task.coreflowContract).toEqual({ gates: ["check", "test"] });

    const workerA = new KanbanBoardStore({ boardSlug: "alpha", env });
    const workerB = new KanbanBoardStore({ boardSlug: "alpha", env });
    try {
      const [claimA, claimB] = await Promise.all([
        Promise.resolve().then(() =>
          workerA.claimTask({ taskId: task.id, workerId: "worker-a" }),
        ),
        Promise.resolve().then(() =>
          workerB.claimTask({ taskId: task.id, workerId: "worker-b" }),
        ),
      ]);

      const winners = [claimA, claimB].filter((c) => c.claimed);
      const losers = [claimA, claimB].filter((c) => !c.claimed);
      expect(winners).toHaveLength(1);
      expect(losers).toHaveLength(1);

      const winner = winners[0]!;
      expect(ownerStore.completeTask({ taskId: task.id, claimLock: "wrong-lock" })).toBe(false);
      expect(ownerStore.completeTask({ taskId: task.id, claimLock: winner.claimLock! })).toBe(true);
      expect(ownerStore.getTask(task.id)?.status).toBe("done");
    } finally {
      workerA.close();
      workerB.close();
      ownerStore.close();
    }
  });

  it("enforces pin_first_board_resolution so dispatched workers cannot cross board boundaries", () => {
    const pinnedDb = "/tmp/state/kanban/boards/alpha/kanban.db";
    const pinnedEnv = {
      ...process.env,
      COREBLOW_KANBAN_DB: pinnedDb,
      COREBLOW_KANBAN_TASK: "task-123",
    };

    expect(resolveKanbanDbPath({ boardSlug: "alpha", env: pinnedEnv })).toBe(pinnedDb);
    expect(() => resolveKanbanDbPath({ boardSlug: "beta", env: pinnedEnv })).toThrow(
      "pin_first_board_resolution",
    );
    expect(() =>
      resolveKanbanDbPath({
        boardSlug: "beta",
        env: { ...process.env, COREBLOW_KANBAN_TASK: "task-123" },
      }),
    ).toThrow("pin_first_board_resolution");
  });
});
