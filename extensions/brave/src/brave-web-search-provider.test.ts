/**
 * extensions/brave/src/brave-web-search-provider.test.ts
 *
 * CoreBlow — Brave Extension Web Search Provider Tests
 */
import { describe, expect, it } from "vitest";
import { createBraveWebSearchProvider } from "./brave-web-search-provider.js";

describe("createBraveWebSearchProvider", () => {
  it("is a function", () => {
    expect(typeof createBraveWebSearchProvider).toBe("function");
  });

  it("returns a non-null object", () => {
    const provider = createBraveWebSearchProvider();
    expect(typeof provider).toBe("object");
    expect(provider).not.toBeNull();
  });

  it("returns object with at least one field", () => {
    const provider = createBraveWebSearchProvider();
    expect(Object.keys(provider).length).toBeGreaterThan(0);
  });

  it("does not throw when called", () => {
    expect(() => createBraveWebSearchProvider()).not.toThrow();
  });
});
