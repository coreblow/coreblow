/**
 * extensions/zai/model-definitions.test.ts
 *
 * CoreBlow — ZAI Extension Model Definitions Tests
 * Verifies ZAI global and CN base URL constants.
 */
import { describe, expect, it } from "vitest";
import {
  ZAI_CODING_CN_BASE_URL,
  ZAI_CODING_GLOBAL_BASE_URL,
  ZAI_GLOBAL_BASE_URL,
} from "./model-definitions.js";

describe("ZAI model definition constants", () => {
  it("ZAI_GLOBAL_BASE_URL is a valid HTTPS URL", () => {
    expect(ZAI_GLOBAL_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("ZAI_GLOBAL_BASE_URL contains api.z.ai", () => {
    expect(ZAI_GLOBAL_BASE_URL).toContain("api.z.ai");
  });

  it("ZAI_CODING_GLOBAL_BASE_URL is a valid HTTPS URL", () => {
    expect(ZAI_CODING_GLOBAL_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("ZAI_CODING_GLOBAL_BASE_URL contains api.z.ai", () => {
    expect(ZAI_CODING_GLOBAL_BASE_URL).toContain("api.z.ai");
  });

  it("ZAI_CODING_CN_BASE_URL is a valid HTTPS URL", () => {
    expect(ZAI_CODING_CN_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("ZAI_CODING_CN_BASE_URL contains bigmodel.cn (CN region)", () => {
    expect(ZAI_CODING_CN_BASE_URL).toContain("bigmodel.cn");
  });

  it("Global and CN base URLs are different", () => {
    expect(ZAI_GLOBAL_BASE_URL).not.toBe(ZAI_CODING_CN_BASE_URL);
  });

  it("all URLs are non-empty strings", () => {
    for (const url of [ZAI_GLOBAL_BASE_URL, ZAI_CODING_GLOBAL_BASE_URL, ZAI_CODING_CN_BASE_URL]) {
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);
    }
  });
});
