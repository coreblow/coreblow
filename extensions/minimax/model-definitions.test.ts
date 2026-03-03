/**
 * extensions/minimax/model-definitions.test.ts
 *
 * CoreBlow — Minimax Extension Model Definitions Tests
 * Verifies Minimax base URL constants and provider objects.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_MINIMAX_BASE_URL } from "./model-definitions.js";

describe("Minimax model definition constants", () => {
  it("DEFAULT_MINIMAX_BASE_URL is a valid HTTPS URL", () => {
    expect(DEFAULT_MINIMAX_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("DEFAULT_MINIMAX_BASE_URL contains minimax.io", () => {
    expect(DEFAULT_MINIMAX_BASE_URL).toContain("minimax.io");
  });

  it("DEFAULT_MINIMAX_BASE_URL ends with /v1", () => {
    expect(DEFAULT_MINIMAX_BASE_URL.endsWith("/v1")).toBe(true);
  });

  it("DEFAULT_MINIMAX_BASE_URL is a non-empty string", () => {
    expect(DEFAULT_MINIMAX_BASE_URL.length).toBeGreaterThan(0);
  });
});
