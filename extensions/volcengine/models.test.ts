/**
 * extensions/volcengine/models.test.ts
 *
 * CoreBlow — Volcengine (Doubao) Extension Models Tests
 * Verifies Doubao base URLs, default model IDs, and model refs.
 */
import { describe, expect, it } from "vitest";
import {
  DOUBAO_BASE_URL,
  DOUBAO_CODING_BASE_URL,
  DOUBAO_CODING_DEFAULT_MODEL_ID,
  DOUBAO_DEFAULT_MODEL_ID,
  DOUBAO_DEFAULT_MODEL_REF,
} from "./models.js";

describe("Volcengine (Doubao) model constants", () => {
  it("DOUBAO_BASE_URL is a valid HTTPS URL", () => {
    expect(DOUBAO_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("DOUBAO_BASE_URL contains volces.com", () => {
    expect(DOUBAO_BASE_URL).toContain("volces.com");
  });

  it("DOUBAO_CODING_BASE_URL is a valid HTTPS URL", () => {
    expect(DOUBAO_CODING_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("DOUBAO_CODING_BASE_URL contains volces.com", () => {
    expect(DOUBAO_CODING_BASE_URL).toContain("volces.com");
  });

  it("DOUBAO_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof DOUBAO_DEFAULT_MODEL_ID).toBe("string");
    expect(DOUBAO_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("DOUBAO_CODING_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof DOUBAO_CODING_DEFAULT_MODEL_ID).toBe("string");
    expect(DOUBAO_CODING_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("DOUBAO_DEFAULT_MODEL_REF starts with volcengine/", () => {
    expect(DOUBAO_DEFAULT_MODEL_REF.startsWith("volcengine/")).toBe(true);
  });

  it("default and coding model IDs are distinct", () => {
    expect(DOUBAO_DEFAULT_MODEL_ID).not.toBe(DOUBAO_CODING_DEFAULT_MODEL_ID);
  });
});
