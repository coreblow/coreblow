import { describe, it, expect } from "vitest";
import {
  applyNativeStreamingUsageCompat,
  normalizeProviderSpecificConfig,
  resolveProviderConfigApiKeyResolver,
} from "./models-config.providers.policy.js";

describe("models-config.providers.policy — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof applyNativeStreamingUsageCompat).toBe("function");
    expect(typeof normalizeProviderSpecificConfig).toBe("function");
    expect(typeof resolveProviderConfigApiKeyResolver).toBe("function");
  });
});
