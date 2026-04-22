import { describe, beforeEach, expect, it } from "vitest";
import {
  resolveControlPlaneRateLimitKey,
  consumeControlPlaneWriteBudget,
  __testing,
} from "./control-plane-rate-limit.js";

beforeEach(() => {
  __testing?.resetControlPlaneRateLimitState?.();
});

describe("resolveControlPlaneRateLimitKey()", () => {
  it("returns a string for null client", () => {
    const key = resolveControlPlaneRateLimitKey(null);
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(0);
  });

  it("returns fallback key for empty client", () => {
    const key = resolveControlPlaneRateLimitKey(null);
    expect(key).toContain("unknown-device");
    expect(key).toContain("unknown-ip");
  });

  it("uses device id when present", () => {
    const client = { connect: { device: { id: "dev-abc" } }, clientIp: "1.2.3.4" } as never;
    const key = resolveControlPlaneRateLimitKey(client);
    expect(key).toContain("dev-abc");
    expect(key).toContain("1.2.3.4");
  });

  it("uses pipe separator between parts", () => {
    const key = resolveControlPlaneRateLimitKey(null);
    expect(key).toContain("|");
  });
});

describe("consumeControlPlaneWriteBudget()", () => {
  const nowMs = Date.now();

  it("allows first request", () => {
    const result = consumeControlPlaneWriteBudget({ client: null, nowMs });
    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBe(0);
  });

  it("returns remaining count >= 0", () => {
    const result = consumeControlPlaneWriteBudget({ client: null, nowMs });
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it("returns the rate limit key used", () => {
    const result = consumeControlPlaneWriteBudget({ client: null, nowMs });
    expect(typeof result.key).toBe("string");
  });

  it("blocks after exceeding max requests in same window", () => {
    const client = { connect: { device: { id: "dev-block" } }, clientIp: "9.9.9.9" } as never;
    const t = Date.now();
    // Use up all 3 slots
    consumeControlPlaneWriteBudget({ client, nowMs: t });
    consumeControlPlaneWriteBudget({ client, nowMs: t });
    consumeControlPlaneWriteBudget({ client, nowMs: t });
    const fourth = consumeControlPlaneWriteBudget({ client, nowMs: t });
    expect(fourth.allowed).toBe(false);
    expect(fourth.retryAfterMs).toBeGreaterThan(0);
  });
});
