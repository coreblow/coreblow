/**
 * extensions/venice/models.test.ts
 *
 * CoreBlow — Venice Extension Models Tests
 * Verifies Venice base URL, default model, and catalog shape.
 */
import { describe, expect, it } from "vitest";
import {
  VENICE_BASE_URL,
  VENICE_DEFAULT_MODEL_ID,
  VENICE_DEFAULT_MODEL_REF,
  VENICE_MODEL_CATALOG,
} from "./models.js";

describe("Venice model constants", () => {
  it("VENICE_BASE_URL is a valid HTTPS URL", () => {
    expect(VENICE_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("VENICE_BASE_URL contains venice.ai", () => {
    expect(VENICE_BASE_URL).toContain("venice.ai");
  });

  it("VENICE_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof VENICE_DEFAULT_MODEL_ID).toBe("string");
    expect(VENICE_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("VENICE_DEFAULT_MODEL_REF starts with venice/", () => {
    expect(VENICE_DEFAULT_MODEL_REF.startsWith("venice/")).toBe(true);
  });

  it("VENICE_DEFAULT_MODEL_REF contains VENICE_DEFAULT_MODEL_ID", () => {
    expect(VENICE_DEFAULT_MODEL_REF).toContain(VENICE_DEFAULT_MODEL_ID);
  });

  it("VENICE_MODEL_CATALOG is an array", () => {
    expect(Array.isArray(VENICE_MODEL_CATALOG)).toBe(true);
  });
});
