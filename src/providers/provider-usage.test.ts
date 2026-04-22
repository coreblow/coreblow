import { describe, beforeEach, expect, it } from "vitest";
import { UsageTracker } from "./provider-usage.js";

let tracker: UsageTracker;

beforeEach(() => {
  tracker = new UsageTracker();
});

describe("UsageTracker — record()", () => {
  it("records a usage entry and returns it", () => {
    const r = tracker.record({
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      latencyMs: 300,
      success: true,
    });
    expect(r.provider).toBe("openai");
    expect(r.totalTokens).toBe(150);
    expect(r.timestamp).toBeGreaterThan(0);
  });

  it("estimates cost for known model", () => {
    const r = tracker.record({
      provider: "openai",
      model: "gpt-4o",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      totalTokens: 2_000_000,
      latencyMs: 1000,
      success: true,
    });
    // gpt-4o: $2.50/1M input + $10.00/1M output = $12.50
    expect(r.estimatedCostUsd).toBeCloseTo(12.5, 2);
  });

  it("estimates zero cost for unknown model", () => {
    const r = tracker.record({
      provider: "custom",
      model: "unknown-model",
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      latencyMs: 100,
      success: true,
    });
    expect(r.estimatedCostUsd).toBe(0);
  });
});

describe("UsageTracker — getStats()", () => {
  beforeEach(() => {
    tracker.record({ provider: "openai", model: "gpt-4o", inputTokens: 100, outputTokens: 50, totalTokens: 150, latencyMs: 200, success: true });
    tracker.record({ provider: "anthropic", model: "claude-3-5-haiku-20241022", inputTokens: 200, outputTokens: 100, totalTokens: 300, latencyMs: 400, success: false });
  });

  it("aggregates total requests", () => {
    expect(tracker.getStats().totalRequests).toBe(2);
  });

  it("computes total tokens", () => {
    expect(tracker.getStats().totalTokens).toBe(450);
  });

  it("computes error count and error rate", () => {
    const stats = tracker.getStats();
    expect(stats.errorCount).toBe(1);
    expect(stats.errorRate).toBeCloseTo(0.5, 2);
  });

  it("filters by provider", () => {
    const stats = tracker.getStats({ provider: "openai" });
    expect(stats.totalRequests).toBe(1);
    expect(stats.errorCount).toBe(0);
  });

  it("filters by model", () => {
    const stats = tracker.getStats({ model: "gpt-4o" });
    expect(stats.totalRequests).toBe(1);
  });

  it("computes average latency", () => {
    const stats = tracker.getStats();
    expect(stats.avgLatencyMs).toBeCloseTo(300, 0);
  });
});

describe("UsageTracker — getModelBreakdown()", () => {
  it("returns per-model breakdown", () => {
    tracker.record({ provider: "openai", model: "gpt-4o", inputTokens: 10, outputTokens: 5, totalTokens: 15, latencyMs: 100, success: true });
    tracker.record({ provider: "openai", model: "gpt-4o", inputTokens: 20, outputTokens: 10, totalTokens: 30, latencyMs: 200, success: true });
    const breakdown = tracker.getModelBreakdown();
    expect(breakdown.length).toBe(1);
    expect(breakdown[0]?.model).toBe("gpt-4o");
    expect(breakdown[0]?.totalRequests).toBe(2);
  });
});

describe("UsageTracker — getRecent() / reset()", () => {
  it("getRecent returns last N records", () => {
    for (let i = 0; i < 5; i++) {
      tracker.record({ provider: "p", model: "m", inputTokens: i, outputTokens: 0, totalTokens: i, latencyMs: 0, success: true });
    }
    expect(tracker.getRecent(3)).toHaveLength(3);
  });

  it("reset clears all records", () => {
    tracker.record({ provider: "p", model: "m", inputTokens: 1, outputTokens: 0, totalTokens: 1, latencyMs: 0, success: true });
    tracker.reset();
    expect(tracker.getStats().totalRequests).toBe(0);
  });
});
