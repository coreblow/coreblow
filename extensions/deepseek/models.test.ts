/**
 * extensions/deepseek/models.test.ts
 *
 * CoreBlow — DeepSeek Extension Models Tests
 * Verifies DeepSeek base URL and model catalog structure.
 */
import { describe, expect, it } from "vitest";
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODEL_CATALOG } from "./models.js";

describe("DeepSeek model constants", () => {
  it("DEEPSEEK_BASE_URL is a valid HTTPS URL", () => {
    expect(DEEPSEEK_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("DEEPSEEK_BASE_URL contains api.deepseek.com", () => {
    expect(DEEPSEEK_BASE_URL).toContain("deepseek.com");
  });

  it("DEEPSEEK_MODEL_CATALOG is an array", () => {
    expect(Array.isArray(DEEPSEEK_MODEL_CATALOG)).toBe(true);
  });

  it("DEEPSEEK_MODEL_CATALOG has at least one model", () => {
    expect(DEEPSEEK_MODEL_CATALOG.length).toBeGreaterThan(0);
  });

  it("each model in catalog has an id field", () => {
    for (const model of DEEPSEEK_MODEL_CATALOG) {
      expect(typeof (model as Record<string, unknown>).id).toBe("string");
    }
  });

  it("no model id is empty", () => {
    for (const model of DEEPSEEK_MODEL_CATALOG) {
      const id = (model as Record<string, unknown>).id as string;
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
