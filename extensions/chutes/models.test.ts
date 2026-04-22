/**
 * extensions/chutes/models.test.ts
 *
 * CoreBlow — Chutes Extension Models Tests
 * Verifies Chutes base URL, default model ID/ref, and catalog shape.
 */
import { describe, expect, it } from "vitest";
import {
  CHUTES_BASE_URL,
  CHUTES_DEFAULT_MODEL_ID,
  CHUTES_DEFAULT_MODEL_REF,
  CHUTES_MODEL_CATALOG,
} from "./models.js";

describe("Chutes model constants", () => {
  it("CHUTES_BASE_URL is a valid HTTPS URL", () => {
    expect(CHUTES_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("CHUTES_BASE_URL contains chutes.ai", () => {
    expect(CHUTES_BASE_URL).toContain("chutes.ai");
  });

  it("CHUTES_BASE_URL ends with /v1", () => {
    expect(CHUTES_BASE_URL.endsWith("/v1")).toBe(true);
  });

  it("CHUTES_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof CHUTES_DEFAULT_MODEL_ID).toBe("string");
    expect(CHUTES_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("CHUTES_DEFAULT_MODEL_REF starts with chutes/", () => {
    expect(CHUTES_DEFAULT_MODEL_REF.startsWith("chutes/")).toBe(true);
  });

  it("CHUTES_DEFAULT_MODEL_REF contains CHUTES_DEFAULT_MODEL_ID", () => {
    expect(CHUTES_DEFAULT_MODEL_REF).toContain(CHUTES_DEFAULT_MODEL_ID);
  });

  it("CHUTES_MODEL_CATALOG is an array", () => {
    expect(Array.isArray(CHUTES_MODEL_CATALOG)).toBe(true);
  });
});
