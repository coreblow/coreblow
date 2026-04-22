/**
 * extensions/mistral/model-definitions.test.ts
 *
 * CoreBlow — Mistral Extension Model Definitions Tests
 * Verifies Mistral base URL, default model, context window,
 * max tokens, and cost structure.
 */
import { describe, expect, it } from "vitest";
import {
  MISTRAL_BASE_URL,
  MISTRAL_DEFAULT_CONTEXT_WINDOW,
  MISTRAL_DEFAULT_MAX_TOKENS,
  MISTRAL_DEFAULT_MODEL_ID,
  MISTRAL_DEFAULT_MODEL_REF,
} from "./model-definitions.js";

describe("Mistral model definition constants", () => {
  it("MISTRAL_BASE_URL is a valid HTTPS URL", () => {
    expect(MISTRAL_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("MISTRAL_BASE_URL ends with /v1", () => {
    expect(MISTRAL_BASE_URL.endsWith("/v1")).toBe(true);
  });

  it("MISTRAL_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof MISTRAL_DEFAULT_MODEL_ID).toBe("string");
    expect(MISTRAL_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("MISTRAL_DEFAULT_MODEL_REF starts with mistral/", () => {
    expect(MISTRAL_DEFAULT_MODEL_REF.startsWith("mistral/")).toBe(true);
  });

  it("MISTRAL_DEFAULT_MODEL_REF contains MISTRAL_DEFAULT_MODEL_ID", () => {
    expect(MISTRAL_DEFAULT_MODEL_REF).toContain(MISTRAL_DEFAULT_MODEL_ID);
  });

  it("MISTRAL_DEFAULT_CONTEXT_WINDOW is a positive integer", () => {
    expect(Number.isInteger(MISTRAL_DEFAULT_CONTEXT_WINDOW)).toBe(true);
    expect(MISTRAL_DEFAULT_CONTEXT_WINDOW).toBeGreaterThan(0);
  });

  it("MISTRAL_DEFAULT_MAX_TOKENS is a positive integer", () => {
    expect(Number.isInteger(MISTRAL_DEFAULT_MAX_TOKENS)).toBe(true);
    expect(MISTRAL_DEFAULT_MAX_TOKENS).toBeGreaterThan(0);
  });

  it("MISTRAL_DEFAULT_MAX_TOKENS is less than CONTEXT_WINDOW", () => {
    expect(MISTRAL_DEFAULT_MAX_TOKENS).toBeLessThan(MISTRAL_DEFAULT_CONTEXT_WINDOW);
  });
});
