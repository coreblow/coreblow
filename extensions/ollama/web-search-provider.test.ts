import { describe, expect, it } from "vitest";
import { createOllamaWebSearchProvider } from "./web-search-provider.js";

describe("ollama web search provider", () => {
  it("declares the provider contract", () => {
    const provider = createOllamaWebSearchProvider();
    expect(provider.id).toBe("ollama");
    expect(provider.requiresCredential).toBe(false);
  });
});
