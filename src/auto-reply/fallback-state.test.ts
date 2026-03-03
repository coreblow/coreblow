// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  normalizeFallbackModelRef,
  formatFallbackAttemptReason,
  buildFallbackReasonSummary,
} from "./fallback-state.js";

describe("fallback-state", () => {
  it("normalizes blank or undefined model refs to undefined", () => {
    expect(normalizeFallbackModelRef(undefined)).toBeUndefined();
    expect(normalizeFallbackModelRef("")).toBeUndefined();
    expect(normalizeFallbackModelRef("  ")).toBeUndefined();
  });

  it("trims whitespace from valid model refs", () => {
    expect(normalizeFallbackModelRef("  openai/gpt-4  ")).toBe("openai/gpt-4");
    expect(normalizeFallbackModelRef("anthropic/claude")).toBe("anthropic/claude");
  });

  it("formats a single fallback attempt reason", () => {
    const reason = formatFallbackAttemptReason({
      selectedModel: "openai/gpt-4",
      activeModel: "anthropic/claude-3",
      reason: "rate limited",
    });
    expect(typeof reason).toBe("string");
    expect(reason.length).toBeGreaterThan(0);
  });

  it("builds summary from multiple fallback attempts", () => {
    const attempts = [
      { selectedModel: "a", activeModel: "b", reason: "rate limit" },
      { selectedModel: "c", activeModel: "d", reason: "timeout" },
    ];
    const summary = buildFallbackReasonSummary(attempts);
    expect(typeof summary).toBe("string");
    expect(summary.length).toBeGreaterThan(0);
  });
});
