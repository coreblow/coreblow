/**
 * extensions/kilocode/provider-models.test.ts
 *
 * CoreBlow — Kilocode Extension Provider Models Tests
 * Verifies Kilocode base URL and default model ID constants.
 */
import { describe, expect, it } from "vitest";
import {
  KILOCODE_BASE_URL,
  KILOCODE_DEFAULT_MODEL_ID,
} from "./provider-models.js";

describe("Kilocode provider model constants", () => {
  it("KILOCODE_BASE_URL is a valid HTTPS URL", () => {
    expect(KILOCODE_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("KILOCODE_BASE_URL contains kilo.ai", () => {
    expect(KILOCODE_BASE_URL).toContain("kilo.ai");
  });

  it("KILOCODE_BASE_URL is a non-empty string", () => {
    expect(KILOCODE_BASE_URL.length).toBeGreaterThan(0);
  });

  it("KILOCODE_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof KILOCODE_DEFAULT_MODEL_ID).toBe("string");
    expect(KILOCODE_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("KILOCODE_DEFAULT_MODEL_ID starts with kilo/", () => {
    expect(KILOCODE_DEFAULT_MODEL_ID.startsWith("kilo/")).toBe(true);
  });
});
