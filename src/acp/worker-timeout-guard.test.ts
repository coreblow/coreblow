import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AcpWorkerTimeoutError,
  AcpWorkerTimeoutGuard,
} from "./worker-timeout-guard.js";

describe("AcpWorkerTimeoutGuard", () => {
  let guard: AcpWorkerTimeoutGuard;

  beforeEach(async () => {
    guard = new AcpWorkerTimeoutGuard({ defaultTimeoutMs: 100 }); // 100ms for fast test execution
    await guard.start();
  });

  afterEach(async () => {
    await guard.stop();
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(guard.health().status).toBe("healthy");
    await guard.stop();
    expect(guard.health().status).toBe("down");
  });

  it("executes tasks successfully within timeout budget", async () => {
    const result = await guard.executeWithTimeout("task-success-1", async (signal) => {
      expect(signal.aborted).toBe(false);
      return { success: true, count: 42 };
    });

    expect(result).toEqual({ success: true, count: 42 });
    expect(guard.getActiveTaskCount()).toBe(0);
  });

  it("aborts runaway subagent tasks when execution timeout is exceeded (CVE-2026-84288 / OWASP ASI08)", async () => {
    await expect(
      guard.executeWithTimeout(
        "task-runaway-1",
        async (signal) => {
          return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve("done"), 500);
            signal.addEventListener("abort", () => {
              clearTimeout(timeout);
            });
          });
        },
        { timeoutMs: 50, subagentId: "subagent-worker-rogue" },
      ),
    ).rejects.toThrow(AcpWorkerTimeoutError);

    expect(guard.getActiveTaskCount()).toBe(0);
    const metrics = guard.getMetricsHistory();
    const taskMetric = metrics.find((m) => m.taskId === "task-runaway-1");
    expect(taskMetric?.timedOut).toBe(true);
    expect(taskMetric?.subagentId).toBe("subagent-worker-rogue");
  });

  it("aborts task when turn limit budget is exceeded", async () => {
    await expect(
      guard.executeWithTimeout(
        "task-turn-limit-1",
        async (signal) => {
          for (let turn = 1; turn <= 5; turn++) {
            guard.recordTurn("task-turn-limit-1");
            if (signal.aborted) {
              const reason = signal.reason;
              throw reason instanceof Error ? reason : new Error(String(reason));
            }
          }
          return "finished";
        },
        { maxTurns: 3 },
      ),
    ).rejects.toThrow(/Turn budget exceeded/);
  });

  it("supports explicit cancellation via abortTask", async () => {
    let taskStarted = false;

    const taskPromise = guard.executeWithTimeout("task-explicit-abort", async (signal) => {
      taskStarted = true;
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("Signal aborted")));
      });
    });

    expect(guard.isTaskRunning("task-explicit-abort")).toBe(true);
    const aborted = guard.abortTask("task-explicit-abort", "User cancelled task");
    expect(aborted).toBe(true);

    await expect(taskPromise).rejects.toThrow(/User cancelled task/);
    expect(guard.isTaskRunning("task-explicit-abort")).toBe(false);
  });
});
