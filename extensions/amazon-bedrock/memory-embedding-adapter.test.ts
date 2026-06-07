import { describe, expect, it } from "vitest";
import { bedrockMemoryEmbeddingProviderAdapter } from "./memory-embedding-adapter.js";

describe("bedrockMemoryEmbeddingProviderAdapter", () => {
  it("registers the expected adapter metadata", () => {
    expect(bedrockMemoryEmbeddingProviderAdapter.id).toBe("bedrock");
    expect(bedrockMemoryEmbeddingProviderAdapter.transport).toBe("remote");
    expect(bedrockMemoryEmbeddingProviderAdapter.authProviderId).toBe("amazon-bedrock");
    expect(bedrockMemoryEmbeddingProviderAdapter.autoSelectPriority).toBe(60);
    expect(bedrockMemoryEmbeddingProviderAdapter.allowExplicitWhenConfiguredAuto).toBe(true);
  });

  it("lets the auto-select loop skip bedrock when credentials are unavailable", () => {
    const error = new Error('No API key found for provider "bedrock". AWS credentials are not available.');
    expect(bedrockMemoryEmbeddingProviderAdapter.shouldContinueAutoSelection?.(error)).toBe(true);
  });
});
