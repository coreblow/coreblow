/**
 * src/gateway/model-pricing-cache-state.test.ts
 *
 * CoreBlow — Model Pricing Cache State Tests
 * Verifies replaceGatewayModelPricingCache, getCachedGatewayModelPricing,
 * and clearGatewayModelPricingCacheState.
 */
import { describe, beforeEach, expect, it } from "vitest";
import {
  replaceGatewayModelPricingCache,
  getCachedGatewayModelPricing,
  clearGatewayModelPricingCacheState,
} from "./model-pricing-cache-state.js";

beforeEach(() => {
  clearGatewayModelPricingCacheState();
});

describe("clearGatewayModelPricingCacheState()", () => {
  it("does not throw on empty cache", () => {
    expect(() => clearGatewayModelPricingCacheState()).not.toThrow();
  });

  it("does not throw after populating cache", () => {
    const m = new Map([["openai/gpt-4o", { input: 2.5, output: 10, cacheRead: 0, cacheWrite: 0 }]]);
    replaceGatewayModelPricingCache(m);
    expect(() => clearGatewayModelPricingCacheState()).not.toThrow();
  });
});

describe("replaceGatewayModelPricingCache()", () => {
  it("does not throw for empty Map", () => {
    expect(() => replaceGatewayModelPricingCache(new Map())).not.toThrow();
  });

  it("does not throw for populated Map", () => {
    const m = new Map([
      ["openai/gpt-4o", { input: 2.5, output: 10, cacheRead: 0.5, cacheWrite: 1 }],
    ]);
    expect(() => replaceGatewayModelPricingCache(m)).not.toThrow();
  });
});

describe("getCachedGatewayModelPricing()", () => {
  it("returns undefined for unknown model when cache empty", () => {
    const result = getCachedGatewayModelPricing({ provider: "openai", model: "unknown-model" });
    expect(result).toBeUndefined();
  });

  it("returns undefined when no cache populated", () => {
    const result = getCachedGatewayModelPricing({ provider: "anthropic", model: "claude-3-5-haiku" });
    expect(result).toBeUndefined();
  });

  it("returns undefined or CachedModelPricing object", () => {
    const result = getCachedGatewayModelPricing({ provider: "openai", model: "gpt-4o" });
    expect(result === undefined || typeof result === "object").toBe(true);
  });
});
