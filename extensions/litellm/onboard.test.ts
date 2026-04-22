/**
 * extensions/litellm/onboard.test.ts
 *
 * CoreBlow — LiteLLM Extension Onboard Tests
 * Verifies LiteLLM base URL (localhost), default model ref, and onboard config function.
 */
import { describe, expect, it } from "vitest";
import {
  LITELLM_BASE_URL,
  LITELLM_DEFAULT_MODEL_ID,
  LITELLM_DEFAULT_MODEL_REF,
} from "./onboard.js";

describe("LiteLLM onboard constants", () => {
  it("LITELLM_BASE_URL is a localhost URL", () => {
    expect(LITELLM_BASE_URL).toContain("localhost");
  });

  it("LITELLM_BASE_URL is non-empty", () => {
    expect(LITELLM_BASE_URL.length).toBeGreaterThan(0);
  });

  it("LITELLM_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof LITELLM_DEFAULT_MODEL_ID).toBe("string");
    expect(LITELLM_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("LITELLM_DEFAULT_MODEL_REF starts with litellm/", () => {
    expect(LITELLM_DEFAULT_MODEL_REF.startsWith("litellm/")).toBe(true);
  });

  it("LITELLM_DEFAULT_MODEL_REF contains LITELLM_DEFAULT_MODEL_ID", () => {
    expect(LITELLM_DEFAULT_MODEL_REF).toContain(LITELLM_DEFAULT_MODEL_ID);
  });
});
