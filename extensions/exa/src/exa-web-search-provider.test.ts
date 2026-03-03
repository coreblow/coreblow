/**
 * extensions/exa/src/exa-web-search-provider.test.ts
 *
 * CoreBlow — Exa Extension Web Search Provider Tests
 */
import { describe, expect, it } from "vitest";
import { createExaWebSearchProvider } from "./exa-web-search-provider.js";

describe("createExaWebSearchProvider", () => {
  it("is a function", () => {
    expect(typeof createExaWebSearchProvider).toBe("function");
  });

  it("returns a non-null object", () => {
    const provider = createExaWebSearchProvider();
    expect(typeof provider).toBe("object");
    expect(provider).not.toBeNull();
  });

  it("returns object with at least one field", () => {
    const provider = createExaWebSearchProvider();
    expect(Object.keys(provider).length).toBeGreaterThan(0);
  });

  it("does not throw when called", () => {
    expect(() => createExaWebSearchProvider()).not.toThrow();
  });
});
