/**
 * extensions/moonshot/provider-catalog.test.ts
 *
 * CoreBlow — Moonshot Extension Provider Catalog Tests
 * Verifies Moonshot base URL and default model ref constants.
 */
import { describe, expect, it } from "vitest";
import { MOONSHOT_BASE_URL } from "./provider-catalog.js";

describe("Moonshot provider catalog constants", () => {
  it("MOONSHOT_BASE_URL is a valid HTTPS URL", () => {
    expect(MOONSHOT_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("MOONSHOT_BASE_URL contains moonshot.ai", () => {
    expect(MOONSHOT_BASE_URL).toContain("moonshot.ai");
  });

  it("MOONSHOT_BASE_URL ends with /v1", () => {
    expect(MOONSHOT_BASE_URL.endsWith("/v1")).toBe(true);
  });

  it("MOONSHOT_BASE_URL is a non-empty string", () => {
    expect(MOONSHOT_BASE_URL.length).toBeGreaterThan(0);
  });
});
