/**
 * extensions/perplexity/src/perplexity-web-search-provider.test.ts
 *
 * CoreBlow — Perplexity Extension Web Search Provider Tests
 */
import { describe, expect, it } from "vitest";
import { createPerplexityWebSearchProvider } from "./perplexity-web-search-provider.js";

describe("createPerplexityWebSearchProvider", () => {
  it("is a function", () => {
    expect(typeof createPerplexityWebSearchProvider).toBe("function");
  });

  it("returns a non-null object", () => {
    const provider = createPerplexityWebSearchProvider();
    expect(typeof provider).toBe("object");
    expect(provider).not.toBeNull();
  });

  it("returns object with at least one field", () => {
    const provider = createPerplexityWebSearchProvider();
    expect(Object.keys(provider).length).toBeGreaterThan(0);
  });

  it("does not throw when called", () => {
    expect(() => createPerplexityWebSearchProvider()).not.toThrow();
  });
});
