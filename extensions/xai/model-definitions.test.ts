/**
 * extensions/xai/model-definitions.test.ts
 *
 * CoreBlow — xAI Extension Model Definitions Tests
 * Verifies xAI base URL, default model, and context window constants.
 */
import { describe, expect, it } from "vitest";
import {
  XAI_BASE_URL,
  XAI_CODE_CONTEXT_WINDOW,
  XAI_DEFAULT_CONTEXT_WINDOW,
  XAI_DEFAULT_MODEL_ID,
  XAI_DEFAULT_MODEL_REF,
  XAI_LARGE_CONTEXT_WINDOW,
} from "./model-definitions.js";

describe("xAI model definition constants", () => {
  it("XAI_BASE_URL is a valid HTTPS URL", () => {
    expect(XAI_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("XAI_BASE_URL ends with /v1", () => {
    expect(XAI_BASE_URL.endsWith("/v1")).toBe(true);
  });

  it("XAI_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof XAI_DEFAULT_MODEL_ID).toBe("string");
    expect(XAI_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("XAI_DEFAULT_MODEL_REF contains provider prefix xai/", () => {
    expect(XAI_DEFAULT_MODEL_REF.startsWith("xai/")).toBe(true);
  });

  it("XAI_DEFAULT_MODEL_REF contains the default model id", () => {
    expect(XAI_DEFAULT_MODEL_REF).toContain(XAI_DEFAULT_MODEL_ID);
  });

  it("XAI_DEFAULT_CONTEXT_WINDOW is a positive integer", () => {
    expect(Number.isInteger(XAI_DEFAULT_CONTEXT_WINDOW)).toBe(true);
    expect(XAI_DEFAULT_CONTEXT_WINDOW).toBeGreaterThan(0);
  });

  it("XAI_LARGE_CONTEXT_WINDOW is larger than DEFAULT_CONTEXT_WINDOW", () => {
    expect(XAI_LARGE_CONTEXT_WINDOW).toBeGreaterThan(XAI_DEFAULT_CONTEXT_WINDOW);
  });

  it("XAI_CODE_CONTEXT_WINDOW is a positive integer", () => {
    expect(Number.isInteger(XAI_CODE_CONTEXT_WINDOW)).toBe(true);
    expect(XAI_CODE_CONTEXT_WINDOW).toBeGreaterThan(0);
  });
});
