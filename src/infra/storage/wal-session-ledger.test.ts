import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WalSessionLedger, type WalSessionRecord } from "./wal-session-ledger.js";

describe("WalSessionLedger", () => {
  let tempDir: string;
  let ledger: WalSessionLedger;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-wal-test-"));
    ledger = new WalSessionLedger({
      baseDir: tempDir,
      flushIntervalMs: 20,
      maxBatchSize: 10,
    });
    await ledger.start();
  });

  afterEach(async () => {
    await ledger.stop();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("reports service lifecycle and health correctly", async () => {
    const healthStarted = ledger.health();
    expect(healthStarted.status).toBe("healthy");
    expect(healthStarted.detail).toContain("Operating normally");

    await ledger.stop();
    const healthStopped = ledger.health();
    expect(healthStopped.status).toBe("down");
  });

  it("appends and replays session events with monotonic sequence and checksums", async () => {
    const sessionId = "session-test-mono";

    const r1 = await ledger.append(sessionId, {
      eventType: "turn",
      agentId: "main",
      payload: { role: "user", text: "Hello CoreBlow" },
    });

    const r2 = await ledger.append(sessionId, {
      eventType: "tool_call",
      agentId: "main",
      subagentId: "worker-1",
      payload: { tool: "fetch_data", args: { id: 123 } },
    });

    expect(r1.sequence).toBe(1);
    expect(r2.sequence).toBe(2);
    expect(r1.checksum).toBeDefined();
    expect(r2.checksum).toBeDefined();

    const replayed = await ledger.replaySession(sessionId);
    expect(replayed).toHaveLength(2);
    expect(replayed[0].sequence).toBe(1);
    expect(replayed[0].payload).toEqual({ role: "user", text: "Hello CoreBlow" });
    expect(replayed[1].sequence).toBe(2);
    expect(replayed[1].subagentId).toBe("worker-1");

    const meta = await ledger.getSessionMeta(sessionId);
    expect(meta).not.toBeNull();
    expect(meta?.lastSequence).toBe(2);
    expect(meta?.totalEvents).toBe(2);
    expect(meta?.agentId).toBe("main");
  });

  it("handles high-concurrency stress test with 50 parallel subagent writes", async () => {
    const sessionId = "session-50-parallel-subagents";
    const subagentCount = 50;

    const parallelWrites = Array.from({ length: subagentCount }, (_, i) => {
      const subagentId = `acp-worker-${i + 1}`;
      return ledger.append(sessionId, {
        eventType: "turn",
        agentId: "main",
        subagentId,
        payload: {
          turnIndex: i + 1,
          action: "execute_task_step",
          metrics: { cpuUsageMs: i * 5, tokensUsed: 100 + i },
        },
      });
    });

    const results = await Promise.all(parallelWrites);
    expect(results).toHaveLength(subagentCount);

    await ledger.flush(sessionId);
    const replayed = await ledger.replaySession(sessionId);

    expect(replayed).toHaveLength(subagentCount);

    const sequences = replayed.map((r) => r.sequence);
    const expectedSequences = Array.from({ length: subagentCount }, (_, i) => i + 1);
    expect(sequences).toEqual(expectedSequences);

    const subagentIds = new Set(replayed.map((r) => r.subagentId));
    expect(subagentIds.size).toBe(subagentCount);

    const meta = await ledger.getSessionMeta(sessionId);
    expect(meta?.lastSequence).toBe(subagentCount);
    expect(meta?.totalEvents).toBe(subagentCount);
  });

  it("supports batch appends and partial replay from a specific sequence", async () => {
    const sessionId = "session-batch-test";

    const batchEntries = [
      {
        eventType: "turn" as const,
        agentId: "main",
        payload: { step: 1 },
      },
      {
        eventType: "tool_call" as const,
        agentId: "main",
        payload: { step: 2 },
      },
      {
        eventType: "tool_result" as const,
        agentId: "main",
        payload: { step: 3 },
      },
    ];

    const records = await ledger.appendBatch(sessionId, batchEntries);
    expect(records).toHaveLength(3);
    expect(records[0].sequence).toBe(1);
    expect(records[1].sequence).toBe(2);
    expect(records[2].sequence).toBe(3);

    const partial = await ledger.replaySession(sessionId, 2);
    expect(partial).toHaveLength(2);
    expect(partial[0].sequence).toBe(2);
    expect(partial[1].sequence).toBe(3);
  });

  it("checkpoints and truncates historical records while preserving subsequent entries", async () => {
    const sessionId = "session-checkpoint-test";

    for (let i = 1; i <= 6; i++) {
      await ledger.append(sessionId, {
        eventType: "telemetry",
        agentId: "main",
        payload: { tick: i },
      });
    }

    const checkpointRes = await ledger.checkpoint(sessionId, 4);
    expect(checkpointRes.checkpointSequence).toBe(4);
    expect(checkpointRes.recordsArchived).toBe(4);
    expect(await fs.stat(checkpointRes.snapshotPath)).toBeDefined();

    const replayedAfter = await ledger.replaySession(sessionId, 1);
    expect(replayedAfter).toHaveLength(2);
    expect(replayedAfter[0].sequence).toBe(5);
    expect(replayedAfter[1].sequence).toBe(6);

    const meta = await ledger.getSessionMeta(sessionId);
    expect(meta?.checkpointSequence).toBe(4);
    expect(meta?.lastSequence).toBe(6);
  });

  it("detects corrupted WAL lines with invalid checksums on replay", async () => {
    const sessionId = "session-corrupt-test";

    const rec = await ledger.append(sessionId, {
      eventType: "turn",
      agentId: "main",
      payload: { secret: "valid-content" },
    });
    await ledger.flush(sessionId);

    const walFilePath = path.join(tempDir, sessionId, "wal.log");
    const corruptedRecord: WalSessionRecord = {
      ...rec,
      payload: { secret: "tampered-content" }, // tamper payload without updating checksum
    };
    await fs.writeFile(walFilePath, JSON.stringify(corruptedRecord) + "\n", "utf8");

    await expect(ledger.replaySession(sessionId)).rejects.toThrow(
      /WAL checksum mismatch in session session-corrupt-test/,
    );
  });
});
