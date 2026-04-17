import { describe, it, expect } from "vitest";
import { computeNextRunAtMs } from "../../src/cron/schedule.js";

describe("cron schedule", () => {
  it("evaluates next run correctly for pure cron", () => {
    const expr = "0 0 * * *"; // Every midnight
    const result = computeNextRunAtMs({ kind: "cron", expr, staggerMs: 0 }, Date.now());
    expect(result).not.toBeUndefined();
    expect(result!).toBeGreaterThan(Date.now());
  });

  it("evaluates next run correctly with timezone", () => {
    const expr = "0 12 * * *";
    const result = computeNextRunAtMs({ kind: "cron", expr, tz: "America/New_York", staggerMs: 0 }, Date.now());
    expect(result).not.toBeUndefined();
    expect(result!).toBeGreaterThan(Date.now());
  });
});
