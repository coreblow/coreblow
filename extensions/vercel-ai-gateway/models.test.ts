/**
 * extensions/vercel-ai-gateway/models.test.ts
 *
 * CoreBlow — Vercel AI Gateway Extension Models Tests
 * Verifies provider ID, base URL, default model ref, and context window.
 */
import { describe, expect, it } from "vitest";
import {
  VERCEL_AI_GATEWAY_BASE_URL,
  VERCEL_AI_GATEWAY_DEFAULT_CONTEXT_WINDOW,
  VERCEL_AI_GATEWAY_DEFAULT_MODEL_ID,
  VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF,
  VERCEL_AI_GATEWAY_PROVIDER_ID,
} from "./models.js";

describe("Vercel AI Gateway model constants", () => {
  it("VERCEL_AI_GATEWAY_PROVIDER_ID is vercel-ai-gateway", () => {
    expect(VERCEL_AI_GATEWAY_PROVIDER_ID).toBe("vercel-ai-gateway");
  });

  it("VERCEL_AI_GATEWAY_BASE_URL is a valid HTTPS URL", () => {
    expect(VERCEL_AI_GATEWAY_BASE_URL.startsWith("https://")).toBe(true);
  });

  it("VERCEL_AI_GATEWAY_BASE_URL contains vercel.sh", () => {
    expect(VERCEL_AI_GATEWAY_BASE_URL).toContain("vercel.sh");
  });

  it("VERCEL_AI_GATEWAY_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof VERCEL_AI_GATEWAY_DEFAULT_MODEL_ID).toBe("string");
    expect(VERCEL_AI_GATEWAY_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF starts with provider id", () => {
    expect(VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF.startsWith(VERCEL_AI_GATEWAY_PROVIDER_ID)).toBe(true);
  });

  it("VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF contains model id", () => {
    expect(VERCEL_AI_GATEWAY_DEFAULT_MODEL_REF).toContain(VERCEL_AI_GATEWAY_DEFAULT_MODEL_ID);
  });

  it("VERCEL_AI_GATEWAY_DEFAULT_CONTEXT_WINDOW is a positive integer", () => {
    expect(Number.isInteger(VERCEL_AI_GATEWAY_DEFAULT_CONTEXT_WINDOW)).toBe(true);
    expect(VERCEL_AI_GATEWAY_DEFAULT_CONTEXT_WINDOW).toBeGreaterThan(0);
  });
});
