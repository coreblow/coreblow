/**
 * extensions/cloudflare-ai-gateway/models.test.ts
 *
 * CoreBlow — Cloudflare AI Gateway Extension Models Tests
 * Verifies provider ID, default model ID, and model ref constants.
 */
import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_ID,
  CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF,
  CLOUDFLARE_AI_GATEWAY_PROVIDER_ID,
} from "./models.js";

describe("Cloudflare AI Gateway constants", () => {
  it("CLOUDFLARE_AI_GATEWAY_PROVIDER_ID is cloudflare-ai-gateway", () => {
    expect(CLOUDFLARE_AI_GATEWAY_PROVIDER_ID).toBe("cloudflare-ai-gateway");
  });

  it("CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_ID is a non-empty string", () => {
    expect(typeof CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_ID).toBe("string");
    expect(CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_ID.length).toBeGreaterThan(0);
  });

  it("CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF starts with provider ID", () => {
    expect(CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF.startsWith(CLOUDFLARE_AI_GATEWAY_PROVIDER_ID)).toBe(true);
  });

  it("CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF contains model ID", () => {
    expect(CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF).toContain(CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_ID);
  });

  it("model ref uses / separator", () => {
    expect(CLOUDFLARE_AI_GATEWAY_DEFAULT_MODEL_REF).toContain("/");
  });
});
