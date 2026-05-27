import { describe, expect, it } from "vitest";
import { isGatewayModelPricingEnabled } from "./model-pricing-config.js";

describe("isGatewayModelPricingEnabled", () => {
  it("enables gateway model pricing unless explicitly disabled", () => {
    expect(isGatewayModelPricingEnabled({})).toBe(true);
    expect(isGatewayModelPricingEnabled({ models: {} })).toBe(true);
    expect(isGatewayModelPricingEnabled({ models: { pricing: { enabled: true } } })).toBe(true);
    expect(isGatewayModelPricingEnabled({ models: { pricing: { enabled: false } } })).toBe(false);
  });
});
