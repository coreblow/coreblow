/**
 * extensions/google/api.test.ts
 *
 * CoreBlow — Google Extension API Constants Tests
 * Verifies Google Gemini API base URL and default model constants.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_GOOGLE_API_BASE_URL,
  GOOGLE_GEMINI_DEFAULT_MODEL,
} from "./api.js";

describe("Google Gemini API constants", () => {
  it("DEFAULT_GOOGLE_API_BASE_URL is a valid HTTPS URL", () => {
    expect(DEFAULT_GOOGLE_API_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("DEFAULT_GOOGLE_API_BASE_URL contains generativelanguage.googleapis.com", () => {
    expect(DEFAULT_GOOGLE_API_BASE_URL).toContain("googleapis.com");
  });

  it("DEFAULT_GOOGLE_API_BASE_URL contains /v1beta version path", () => {
    expect(DEFAULT_GOOGLE_API_BASE_URL).toContain("/v1beta");
  });

  it("GOOGLE_GEMINI_DEFAULT_MODEL is a non-empty string", () => {
    expect(typeof GOOGLE_GEMINI_DEFAULT_MODEL).toBe("string");
    expect(GOOGLE_GEMINI_DEFAULT_MODEL.length).toBeGreaterThan(0);
  });

  it("GOOGLE_GEMINI_DEFAULT_MODEL starts with google/", () => {
    expect(GOOGLE_GEMINI_DEFAULT_MODEL.startsWith("google/")).toBe(true);
  });

  it("GOOGLE_GEMINI_DEFAULT_MODEL contains gemini", () => {
    expect(GOOGLE_GEMINI_DEFAULT_MODEL.toLowerCase()).toContain("gemini");
  });
});
