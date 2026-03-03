/**
 * extensions/browser/src/browser/proxy-files.test.ts
 *
 * CoreBlow — Browser Extension: Proxy-files Tests
 * Verifies Proxy file path resolution and serving.
 */
import { describe, expect, it } from "vitest";
import { applyBrowserProxyPaths } from "./proxy-files.js";

describe("applyBrowserProxyPaths", () => {
  it("applies path mapping for result.path", () => {
    const mapping = new Map([["old/path.png", "/new/path.png"]]);
    const result = { path: "old/path.png", content: "data" };
    applyBrowserProxyPaths(result, mapping);
    expect(result.path).toBe("/new/path.png");
  });

  it("applies imagePath mapping", () => {
    const mapping = new Map([["old/image.png", "/new/image.png"]]);
    const result: any = { imagePath: "old/image.png" };
    applyBrowserProxyPaths(result, mapping);
    expect(result.imagePath).toBe("/new/image.png");
  });

  it("applies download.path mapping", () => {
    const mapping = new Map([["old/file.pdf", "/new/file.pdf"]]);
    const result: any = { download: { path: "old/file.pdf" } };
    applyBrowserProxyPaths(result, mapping);
    expect(result.download.path).toBe("/new/file.pdf");
  });

  it("does not modify unmapped paths", () => {
    const mapping = new Map([["other/path.png", "/new/other.png"]]);
    const result = { path: "original.png" };
    applyBrowserProxyPaths(result, mapping);
    expect(result.path).toBe("original.png");
  });

  it("ignores non-object result", () => {
    const mapping = new Map([["a", "b"]]);
    expect(() => applyBrowserProxyPaths(null, mapping)).not.toThrow();
    expect(() => applyBrowserProxyPaths(undefined, mapping)).not.toThrow();
    expect(() => applyBrowserProxyPaths("string", mapping)).not.toThrow();
    expect(() => applyBrowserProxyPaths(42, mapping)).not.toThrow();
  });

  it("handles empty mapping without error", () => {
    const mapping = new Map<string, string>();
    const result = { path: "some/path.png" };
    applyBrowserProxyPaths(result, mapping);
    expect(result.path).toBe("some/path.png");
  });

  it("applies all three path types simultaneously", () => {
    const mapping = new Map([
      ["a.png", "/stored/a.png"],
      ["b.jpg", "/stored/b.jpg"],
      ["c.pdf", "/stored/c.pdf"],
    ]);
    const result: any = {
      path: "a.png",
      imagePath: "b.jpg",
      download: { path: "c.pdf" },
    };
    applyBrowserProxyPaths(result, mapping);
    expect(result.path).toBe("/stored/a.png");
    expect(result.imagePath).toBe("/stored/b.jpg");
    expect(result.download.path).toBe("/stored/c.pdf");
  });
});
