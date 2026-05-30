import { afterEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { startHeartbeatRunner } from "./heartbeat-runner.js";
import { requestHeartbeatNow, resetHeartbeatWakeStateForTests } from "./heartbeat-wake.js";

describe("heartbeat runner commitment-adjacent scheduling", () => {
  afterEach(() => {
    resetHeartbeatWakeStateForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function targetNoneConfig(): CoreBlowConfig {
    return {
      agents: {
        defaults: {
          heartbeat: {
            every: "5m",
            target: "none",
          },
        },
      },
    } as CoreBlowConfig;
  }

  it("does not wake an extra commitment session when heartbeat target is none", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-04-29T17:00:00.000Z"));

    const runOnce = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    const runner = startHeartbeatRunner({
      cfg: targetNoneConfig(),
      runOnce,
    });

    requestHeartbeatNow({ reason: "manual", coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    runner.stop();

    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(runOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "main",
        heartbeat: expect.objectContaining({ target: "none" }),
        reason: "manual",
      }),
    );
    expect(runOnce.mock.calls[0]?.[0].sessionKey).toBeUndefined();
  });

  it("keeps explicitly targeted wakes scoped even when the agent default target is none", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-04-29T17:00:00.000Z"));

    const sessionKey = "agent:main:telegram:user-155462274";
    const runOnce = vi.fn().mockResolvedValue({ status: "ran", durationMs: 1 });
    const runner = startHeartbeatRunner({
      cfg: targetNoneConfig(),
      runOnce,
    });

    requestHeartbeatNow({ reason: "manual", sessionKey, coalesceMs: 0 });
    await vi.advanceTimersByTimeAsync(1);
    runner.stop();

    expect(runOnce).toHaveBeenCalledTimes(1);
    expect(runOnce).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "main",
        heartbeat: expect.objectContaining({ target: "none" }),
        reason: "manual",
        sessionKey,
      }),
    );
  });
});
