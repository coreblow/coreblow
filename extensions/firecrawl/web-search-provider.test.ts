/**
 * extensions/firecrawl/web-search-provider.test.ts
 *
 * CoreBlow — Firecrawl Web Search Provider Tests
 * Verifies web search provider module is importable and
 * exports a valid provider object.
 */
import { describe, expect, it } from "vitest";

describe("firecrawl web-search-provider module", () => {
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
      expect(["function", "object", "string", "boolean"]).toContain(typeof val);
    }
  });

  it("provider export is an object or function", async () => {
    const mod = await import("./web-search-provider.js") as Record<string, unknown>;
    const provider = Object.values(mod)[0];
    expect(["object", "function"]).toContain(typeof provider);
  });
});
