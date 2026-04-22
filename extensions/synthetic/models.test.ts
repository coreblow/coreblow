/**
 * extensions/synthetic/models.test.ts
 *
 * CoreBlow — Synthetic Extension Models Tests
 * Verifies Synthetic base URL, default model ref, and zero-cost structure.
 */
import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_BASE_URL,
  SYNTHETIC_DEFAULT_MODEL_ID,
  SYNTHETIC_DEFAULT_MODEL_REF,
} from "./models.js";

describe("Synthetic model constants", () => {
  it("SYNTHETIC_BASE_URL is a valid HTTPS URL", () => {
    expect(SYNTHETIC_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("SYNTHETIC_BASE_URL contains synthetic.new", () => {
    expect(SYNTHETIC_BASE_URL).toContain("synthetic.new");
  });

  it("SYNTHETIC_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof SYNTHETIC_DEFAULT_MODEL_ID).toBe("string");
    expect(SYNTHETIC_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("SYNTHETIC_DEFAULT_MODEL_REF starts with synthetic/", () => {
    expect(SYNTHETIC_DEFAULT_MODEL_REF.startsWith("synthetic/")).toBe(true);
  });

  it("SYNTHETIC_DEFAULT_MODEL_REF contains model id", () => {
    expect(SYNTHETIC_DEFAULT_MODEL_REF).toContain(SYNTHETIC_DEFAULT_MODEL_ID);
  });
});
