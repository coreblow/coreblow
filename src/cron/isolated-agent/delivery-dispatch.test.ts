import { describe, expect, it } from "vitest";
import {
  getCompletedDirectCronDeliveriesCountForTests,
  resolveCronDeliveryBestEffort,
  resetCompletedDirectCronDeliveriesForTests,
} from "./delivery-dispatch.js";
import type { CronJob } from "../../cron/types.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "job-1",
    enabled: true,
    createdAtMs: Date.now() - 120_000,
    payload: { type: "prompt", prompt: "hello" },
    schedule: { kind: "every", everyMs: 60_000 },
    sessionTarget: { type: "channel", channelId: "discord:123" },
    state: { lastRunAtMs: null, nextRunAtMs: null, consecutiveFailures: 0 },
    ...overrides,
  } as unknown as CronJob;
}

// ── resolveCronDeliveryBestEffort ─────────────────────────────────────────────

describe("resolveCronDeliveryBestEffort", () => {
  it("returns a boolean", () => {
    const result = resolveCronDeliveryBestEffort(makeJob());
    expect(typeof result).toBe("boolean");
  });

  it("does not throw for any valid job", () => {
    expect(() => resolveCronDeliveryBestEffort(makeJob())).not.toThrow();
  });

  it("is consistent for same job", () => {
    const job = makeJob();
    const r1 = resolveCronDeliveryBestEffort(job);
    const r2 = resolveCronDeliveryBestEffort(job);
    expect(r1).toBe(r2);
  });
});

// ── test counter utilities ────────────────────────────────────────────────────

describe("cron delivery test counters", () => {
  it("getCompletedDirectCronDeliveriesCountForTests returns non-negative number", () => {
    const count = getCompletedDirectCronDeliveriesCountForTests();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("resetCompletedDirectCronDeliveriesForTests resets counter to 0", () => {
    resetCompletedDirectCronDeliveriesForTests();
    expect(getCompletedDirectCronDeliveriesCountForTests()).toBe(0);
  });

  it("counter stays 0 after multiple resets", () => {
    resetCompletedDirectCronDeliveriesForTests();
    resetCompletedDirectCronDeliveriesForTests();
    expect(getCompletedDirectCronDeliveriesCountForTests()).toBe(0);
  });
});
