import { describe, expect, it } from "vitest";
import {
  CONTEXT_WINDOW_HARD_MIN_TOKENS,
  CONTEXT_WINDOW_WARN_BELOW_TOKENS,
  evaluateContextWindowGuard,
  type ContextWindowInfo,
} from "./context-window-guard.js";

describe("context-window-guard", () => {
  it("exports expected threshold constants", () => {
    expect(CONTEXT_WINDOW_HARD_MIN_TOKENS).toBe(16_000);
    expect(CONTEXT_WINDOW_WARN_BELOW_TOKENS).toBe(32_000);
  });

  it("blocks when context window is below the hard minimum", () => {
    const info: ContextWindowInfo = { tokens: 8_000, source: "model" };
    const result = evaluateContextWindowGuard({ info });
    expect(result.shouldBlock).toBe(true);
  });

  it("warns but does not block between hard min and warn threshold", () => {
    const info: ContextWindowInfo = { tokens: 20_000, source: "model" };
    const result = evaluateContextWindowGuard({ info });
    expect(result.shouldBlock).toBe(false);
    expect(result.shouldWarn).toBe(true);
  });

  it("does not warn or block at or above the warn threshold", () => {
    const info: ContextWindowInfo = { tokens: 128_000, source: "model" };
    const result = evaluateContextWindowGuard({ info });
    expect(result.shouldBlock).toBe(false);
    expect(result.shouldWarn).toBe(false);
  });

  it("allows overriding thresholds", () => {
    const info: ContextWindowInfo = { tokens: 12_000, source: "model" };
    const result = evaluateContextWindowGuard({
      info,
      hardMinTokens: 8_000,
      warnBelowTokens: 16_000,
    });
    expect(result.shouldBlock).toBe(false);
    expect(result.shouldWarn).toBe(true);
  });

  it("preserves source and tokens from info in the result", () => {
    const info: ContextWindowInfo = { tokens: 64_000, source: "model" };
    const result = evaluateContextWindowGuard({ info });
    expect(result.tokens).toBe(64_000);
    expect(result.source).toBe("model");
  });
});
