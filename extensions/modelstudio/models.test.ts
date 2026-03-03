/**
 * extensions/modelstudio/models.test.ts
 *
 * CoreBlow — ModelStudio Extension Models Tests
 * Verifies ModelStudio base URL variants for global and CN regions.
 */
import { describe, expect, it } from "vitest";
import {
  MODELSTUDIO_BASE_URL,
  MODELSTUDIO_CN_BASE_URL,
  MODELSTUDIO_GLOBAL_BASE_URL,
} from "./models.js";

describe("ModelStudio base URL constants", () => {
  it("MODELSTUDIO_BASE_URL is a valid HTTPS URL", () => {
    expect(MODELSTUDIO_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("MODELSTUDIO_BASE_URL contains aliyuncs.com", () => {
    expect(MODELSTUDIO_BASE_URL).toContain("aliyuncs.com");
  });

  it("MODELSTUDIO_GLOBAL_BASE_URL equals MODELSTUDIO_BASE_URL", () => {
    expect(MODELSTUDIO_GLOBAL_BASE_URL).toBe(MODELSTUDIO_BASE_URL);
  });

  it("MODELSTUDIO_CN_BASE_URL is a valid HTTPS URL", () => {
    expect(MODELSTUDIO_CN_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("MODELSTUDIO_CN_BASE_URL contains aliyuncs.com", () => {
    expect(MODELSTUDIO_CN_BASE_URL).toContain("aliyuncs.com");
  });

  it("all base URLs are non-empty strings", () => {
    for (const url of [MODELSTUDIO_BASE_URL, MODELSTUDIO_GLOBAL_BASE_URL, MODELSTUDIO_CN_BASE_URL]) {
      expect(typeof url).toBe("string");
      expect(url.length).toBeGreaterThan(0);
    }
  });
});
