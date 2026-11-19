import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CheckpointManager } from "./checkpoint-manager.js";

describe("CheckpointManager", () => {
  let tmpDir: string;
  let testFile: string;
  let checkpointDir: string;
  let manager: CheckpointManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cb-cp-test-"));
    testFile = path.join(tmpDir, "sample.txt");
    checkpointDir = path.join(tmpDir, "checkpoints");
    manager = new CheckpointManager(checkpointDir, 5); // limit to 5 for test
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Cleanup
    }
  });

  it("snapshots existing file and restores original contents on rollback", () => {
    fs.writeFileSync(testFile, "Initial content v1", "utf8");

    const cp = manager.createCheckpoint(testFile, "patch", "sess_1");
    expect(cp.existed).toBe(true);
    expect(cp.toolName).toBe("patch");
    expect(cp.sessionId).toBe("sess_1");

    // Modify file
    fs.writeFileSync(testFile, "Mutated content v2 by agent", "utf8");
    expect(fs.readFileSync(testFile, "utf8")).toBe("Mutated content v2 by agent");

    // Rollback
    const rollback = manager.rollbackCheckpoint(cp.id);
    expect(rollback.success).toBe(true);
    expect(fs.readFileSync(testFile, "utf8")).toBe("Initial content v1");
  });

  it("snapshots non-existent file and removes it on rollback", () => {
    const newFile = path.join(tmpDir, "created_by_agent.txt");
    expect(fs.existsSync(newFile)).toBe(false);

    const cp = manager.createCheckpoint(newFile, "write_file", "sess_2");
    expect(cp.existed).toBe(false);

    // Agent creates file
    fs.writeFileSync(newFile, "Newly created file content", "utf8");
    expect(fs.existsSync(newFile)).toBe(true);

    // Rollback removes it
    const rollback = manager.rollbackCheckpoint(cp.id);
    expect(rollback.success).toBe(true);
    expect(fs.existsSync(newFile)).toBe(false);
  });

  it("rolls back latest checkpoint for session when no ID provided", () => {
    fs.writeFileSync(testFile, "Original", "utf8");
    manager.createCheckpoint(testFile, "write_file", "sess_a");

    fs.writeFileSync(testFile, "Changed Sess A", "utf8");

    const fileB = path.join(tmpDir, "b.txt");
    fs.writeFileSync(fileB, "Original B", "utf8");
    manager.createCheckpoint(fileB, "write_file", "sess_b");
    fs.writeFileSync(fileB, "Changed Sess B", "utf8");

    // Rollback session B specifically
    const rollbackB = manager.rollbackCheckpoint(undefined, "sess_b");
    expect(rollbackB.success).toBe(true);
    expect(fs.readFileSync(fileB, "utf8")).toBe("Original B");
    // File A remains modified
    expect(fs.readFileSync(testFile, "utf8")).toBe("Changed Sess A");
  });

  it("prunes oldest checkpoints exceeding max limit", () => {
    for (let i = 1; i <= 8; i++) {
      fs.writeFileSync(testFile, `Content iteration ${i}`, "utf8");
      manager.createCheckpoint(testFile, "patch", `sess_${i}`);
    }

    const list = manager.listCheckpoints();
    expect(list.length).toBe(5); // pruned to 5
    expect(list[0].sessionId).toBe("sess_8");
    expect(list[4].sessionId).toBe("sess_4");
  });
});
