/**
 * extensions/together/models.test.ts
 *
 * CoreBlow — Together AI Extension Models Tests
 * Verifies Together base URL, default model ref, and model catalog.
 */
import { describe, expect, it } from "vitest";
import { TOGETHER_BASE_URL, TOGETHER_MODEL_CATALOG } from "./models.js";

describe("Together AI model constants", () => {
  it("TOGETHER_BASE_URL is a valid HTTPS URL", () => {
    expect(TOGETHER_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("TOGETHER_BASE_URL contains together.xyz", () => {
    expect(TOGETHER_BASE_URL).toContain("together.xyz");
  });

  it("TOGETHER_BASE_URL ends with /v1", () => {
    expect(TOGETHER_BASE_URL.endsWith("/v1")).toBe(true);
  });

  it("TOGETHER_MODEL_CATALOG is an array", () => {
    expect(Array.isArray(TOGETHER_MODEL_CATALOG)).toBe(true);
  });

  it("TOGETHER_MODEL_CATALOG has at least one model", () => {
    expect(TOGETHER_MODEL_CATALOG.length).toBeGreaterThan(0);
  });

  it("each model has a non-empty id", () => {
    for (const model of TOGETHER_MODEL_CATALOG) {
      const id = (model as Record<string, unknown>).id as string;
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
