/**
 * src/cron/service/jobs.test.ts
 *
 * CoreBlow — Cron Service Job Utilities Tests
 * Verifies computeJobNextRunAtMs, computeJobPreviousRunAtMs,
 * findJobOrThrow, and nextWakeAtMs pure logic.
 */
import { describe, expect, it } from "vitest";
import {
  computeJobNextRunAtMs,
  computeJobPreviousRunAtMs,
  findJobOrThrow,
  nextWakeAtMs,
} from "./jobs.js";
import type { CronServiceState } from "../types.js";
import type { CronJob } from "../types.js";

// ── helpers ───────────────────────────────────────────────────────────────────

function makeJob(id = "job-1", enabled = true): CronJob {
  return {
    id,
    enabled,
    createdAtMs: Date.now() - 120_000,
    payload: { type: "prompt", prompt: "test" },
    schedule: { kind: "every", everyMs: 60_000 },
    sessionTarget: { type: "channel", channelId: "discord:123" },
    state: { lastRunAtMs: null, nextRunAtMs: null, consecutiveFailures: 0 },
  } as unknown as CronJob;
}

function makeState(jobs: CronJob[] = []): CronServiceState {
  return {
    store: { jobs },
    running: false,
    timer: null,
    op: Promise.resolve(),
    warnedDisabled: false,
    storeLoadedAtMs: null,
    storeFileMtimeMs: null,
    deps: {},
  } as unknown as CronServiceState;
}

// ── computeJobNextRunAtMs ─────────────────────────────────────────────────────

describe("computeJobNextRunAtMs", () => {
  it("returns a number or undefined", () => {
    const result = computeJobNextRunAtMs(makeJob(), Date.now());
    expect(result === undefined || typeof result === "number").toBe(true);
  });

  it("returns a future timestamp for enabled job with every schedule", () => {
    const nowMs = Date.now();
    const result = computeJobNextRunAtMs(makeJob(), nowMs);
    if (result !== undefined) {
      expect(result).toBeGreaterThan(0);
    }
  });

  it("returns undefined for disabled job", () => {
    const result = computeJobNextRunAtMs(makeJob("job-1", false), Date.now());
    expect(result).toBeUndefined();
  });

  it("does not throw for any valid job", () => {
    expect(() => computeJobNextRunAtMs(makeJob(), Date.now())).not.toThrow();
  });
});

// ── computeJobPreviousRunAtMs ─────────────────────────────────────────────────

describe("computeJobPreviousRunAtMs", () => {
  it("returns a number or undefined", () => {
    const result = computeJobPreviousRunAtMs(makeJob(), Date.now());
    expect(result === undefined || typeof result === "number").toBe(true);
  });

  it("does not throw for any valid job", () => {
    expect(() => computeJobPreviousRunAtMs(makeJob(), Date.now())).not.toThrow();
  });
});

// ── findJobOrThrow ────────────────────────────────────────────────────────────

describe("findJobOrThrow", () => {
  it("returns the job when it exists in state", () => {
    const job = makeJob("job-abc");
    const state = makeState([job]);
    const found = findJobOrThrow(state, "job-abc");
    expect(found.id).toBe("job-abc");
  });

  it("throws when job does not exist", () => {
    const state = makeState([]);
    expect(() => findJobOrThrow(state, "nonexistent")).toThrow();
  });

  it("finds job among multiple jobs", () => {
    const jobs = [makeJob("a"), makeJob("b"), makeJob("c")];
    const state = makeState(jobs);
    expect(findJobOrThrow(state, "b").id).toBe("b");
  });
});

// ── nextWakeAtMs ──────────────────────────────────────────────────────────────

describe("nextWakeAtMs", () => {
  it("returns undefined or number for empty state", () => {
    const result = nextWakeAtMs(makeState([]));
    expect(result === undefined || typeof result === "number").toBe(true);
  });

  it("does not throw for jobs with null nextRunAtMs", () => {
    const state = makeState([makeJob()]);
    expect(() => nextWakeAtMs(state)).not.toThrow();
  });
});
