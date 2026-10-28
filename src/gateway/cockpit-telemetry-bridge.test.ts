import { beforeEach, describe, expect, it } from "vitest";
import { AcpWorkerTimeoutGuard } from "../acp/worker-timeout-guard.js";
import { CockpitTelemetryBridge } from "./cockpit-telemetry-bridge.js";

describe("CockpitTelemetryBridge", () => {
  let bridge: CockpitTelemetryBridge;
  let workerGuard: AcpWorkerTimeoutGuard;

  beforeEach(async () => {
    workerGuard = new AcpWorkerTimeoutGuard({ defaultTimeoutMs: 10_000 });
    await workerGuard.start();

    bridge = new CockpitTelemetryBridge({ workerGuard });
    await bridge.start();
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(bridge.health().status).toBe("healthy");
    await bridge.stop();
    expect(bridge.health().status).toBe("down");
  });

  it("tracks subagent graph state and turn metrics", () => {
    bridge.registerSubagent("sub-agent-1", "main-agent");
    bridge.updateSubagentTurn("sub-agent-1", 150, "web_search");

    const snapshot = bridge.getSnapshot();
    expect(snapshot.activeSubagents).toHaveLength(1);
    const subNode = snapshot.activeSubagents[0];
    expect(subNode.subagentId).toBe("sub-agent-1");
    expect(subNode.parentAgentId).toBe("main-agent");
    expect(subNode.status).toBe("running");
    expect(subNode.turnCount).toBe(1);
    expect(subNode.tokensUsed).toBe(150);
    expect(subNode.activeTool).toBe("web_search");

    bridge.completeSubagent("sub-agent-1", "completed");
    expect(bridge.getSnapshot().activeSubagents[0].status).toBe("completed");
  });

  it("registers scratchpad pointer references and retains history", () => {
    bridge.registerScratchpadPointer({
      contentHash: "hash-1234567890abcdef",
      byteLength: 4096,
      preview: "Preview of tool data...",
    });

    const snapshot = bridge.getSnapshot();
    expect(snapshot.recentScratchpadPointers).toHaveLength(1);
    expect(snapshot.recentScratchpadPointers[0].contentHash).toBe("hash-1234567890abcdef");
  });

  it("streams live updates to telemetry subscribers", () => {
    const receivedSnapshots: unknown[] = [];
    const unsubscribe = bridge.subscribe((snapshot) => {
      receivedSnapshots.push(snapshot);
    });

    bridge.registerSubagent("sub-agent-stream", "main");
    bridge.updateSubagentTurn("sub-agent-stream", 50);

    expect(receivedSnapshots.length).toBeGreaterThanOrEqual(3); // Initial + register + turn
    unsubscribe();
  });

  it("executes deterministic Emergency Kill-Switch and locks down the gateway", () => {
    bridge.registerSubagent("sub-1", "main");
    bridge.registerSubagent("sub-2", "main");

    const killResult = bridge.triggerEmergencyKillSwitch("Hardware emergency button pressed");
    expect(killResult.lockdown).toBe(true);
    expect(killResult.abortedCount).toBe(2);

    const snapshot = bridge.getSnapshot();
    expect(snapshot.isLockdown).toBe(true);
    expect(snapshot.activeSubagents.every((s) => s.status === "aborted")).toBe(true);
    expect(bridge.health().status).toBe("degraded");

    // Denies new registrations during lockdown
    expect(() => bridge.registerSubagent("sub-3", "main")).toThrow(/Emergency Lockdown/);

    // Resets lockdown
    bridge.resetLockdown();
    expect(bridge.getSnapshot().isLockdown).toBe(false);
    expect(bridge.health().status).toBe("healthy");
  });
});
