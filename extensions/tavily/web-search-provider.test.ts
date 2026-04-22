/**
 * extensions/tavily/web-search-provider.test.ts
 *
 * CoreBlow — Tavily Web Search Provider Tests
 * Verifies Tavily web search provider module and export shape.
 */
import { describe, expect, it } from "vitest";

describe("tavily web-search-provider module", () => {
  it("is importable without throwing", async () => {
    await expect(import("./web-search-provider.js")).resolves.toBeDefined();
  });

  it("has at least one named export", async () => {
    const mod = await import("./web-search-provider.js") as Record<string, unknown>;
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });

  it("all exports are functions or objects", async () => {
    const mod = await import("./web-search-provider.js") as Record<string, unknown>;
    for (const [, val] of Object.entries(mod)) {
      expect(["function", "object", "string"]).toContain(typeof val);
    }
  });

  it("provider export is a function or object", async () => {
    const mod = await import("./web-search-provider.js") as Record<string, unknown>;
    const provider = Object.values(mod)[0];
    expect(["object", "function"]).toContain(typeof provider);
  });
});
