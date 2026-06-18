import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createFileAcpEventLedger, createInMemoryAcpEventLedger } from "./event-ledger.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

describe("ACP event ledger", () => {
  it("replays complete sessions and returns cloned events", async () => {
    const ledger = createInMemoryAcpEventLedger({ now: () => 10 });
    await ledger.startSession({ sessionId: "s1", sessionKey: "agent:main:main", cwd: "/tmp", complete: true });
    await ledger.recordUpdate({
      sessionId: "s1",
      sessionKey: "agent:main:main",
      runId: "r1",
      update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "hello" } },
    });
    const replay = await ledger.readReplay({ sessionId: "s1", sessionKey: "agent:main:main" });
    expect(replay.complete).toBe(true);
    expect(replay.events).toHaveLength(1);
    expect(replay.events[0]).toMatchObject({ seq: 1, runId: "r1" });
  });

  it("persists replay data atomically", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-acp-ledger-"));
    tempDirs.push(dir);
    const filePath = path.join(dir, "ledger.json");
    const writer = createFileAcpEventLedger({ filePath });
    await writer.startSession({ sessionId: "s1", sessionKey: "key", cwd: dir, complete: true });
    await writer.recordUserPrompt({
      sessionId: "s1",
      sessionKey: "key",
      runId: "r1",
      prompt: [{ type: "text", text: "hello" }],
    });
    const reader = createFileAcpEventLedger({ filePath });
    await expect(reader.readReplayBySessionId({ sessionId: "s1" })).resolves.toMatchObject({
      complete: true,
      sessionKey: "key",
      events: [{ seq: 1 }],
    });
  });
});
