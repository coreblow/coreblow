/**
 * extensions/ollama/src/defaults.test.ts
 *
 * CoreBlow — Ollama Extension Defaults Tests
 * Verifies Ollama default URL, context window, max tokens,
 * and zero-cost structure for local inference.
 */
import { describe, expect, it } from "vitest";
import {
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_DEFAULT_CONTEXT_WINDOW,
  OLLAMA_DEFAULT_COST,
  OLLAMA_DEFAULT_MAX_TOKENS,
} from "./defaults.js";

describe("Ollama default constants", () => {
  it("OLLAMA_DEFAULT_BASE_URL is a valid localhost URL", () => {
    expect(OLLAMA_DEFAULT_BASE_URL.startsWith("http://")).toBe(true);
    expect(OLLAMA_DEFAULT_BASE_URL).toContain("127.0.0.1");
  });

  it("OLLAMA_DEFAULT_BASE_URL contains port 11434", () => {
    expect(OLLAMA_DEFAULT_BASE_URL).toContain("11434");
  });

  it("OLLAMA_DEFAULT_CONTEXT_WINDOW is a positive integer", () => {
    expect(Number.isInteger(OLLAMA_DEFAULT_CONTEXT_WINDOW)).toBe(true);
    expect(OLLAMA_DEFAULT_CONTEXT_WINDOW).toBeGreaterThan(0);
  });

  it("OLLAMA_DEFAULT_MAX_TOKENS is a positive integer", () => {
    expect(Number.isInteger(OLLAMA_DEFAULT_MAX_TOKENS)).toBe(true);
    expect(OLLAMA_DEFAULT_MAX_TOKENS).toBeGreaterThan(0);
  });

  it("OLLAMA_DEFAULT_MAX_TOKENS is less than CONTEXT_WINDOW", () => {
    expect(OLLAMA_DEFAULT_MAX_TOKENS).toBeLessThan(OLLAMA_DEFAULT_CONTEXT_WINDOW);
  });
});

describe("OLLAMA_DEFAULT_COST (zero-cost local inference)", () => {
  it("is a non-null object", () => {
    expect(typeof OLLAMA_DEFAULT_COST).toBe("object");
    expect(OLLAMA_DEFAULT_COST).not.toBeNull();
  });

  it("input cost is 0 (local inference)", () => {
    expect(OLLAMA_DEFAULT_COST.input).toBe(0);
  });

  it("output cost is 0 (local inference)", () => {
    expect(OLLAMA_DEFAULT_COST.output).toBe(0);
  });

  it("cacheRead cost is 0", () => {
    expect(OLLAMA_DEFAULT_COST.cacheRead).toBe(0);
  });

  it("cacheWrite cost is 0", () => {
    expect(OLLAMA_DEFAULT_COST.cacheWrite).toBe(0);
  });

  it("all cost values are non-negative numbers", () => {
    for (const [, v] of Object.entries(OLLAMA_DEFAULT_COST)) {
      expect(typeof v).toBe("number");
      expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});
