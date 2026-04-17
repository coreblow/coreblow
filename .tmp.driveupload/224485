import { describe, expect, it } from "vitest";
import { listBundledWebSearchPluginIds } from "./bundled-web-search.js";

describe("bundled web search metadata", () => {
  it("lists available web search plugin ids", () => {
    const ids = listBundledWebSearchPluginIds();
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    }
  });
});
