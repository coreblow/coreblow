/**
 * extensions/anthropic-vertex/region.test.ts
 *
 * CoreBlow — Anthropic Vertex Region Resolver Tests
 */
import { describe, expect, it } from "vitest";
import {
  resolveAnthropicVertexRegion,
  resolveAnthropicVertexRegionFromBaseUrl,
} from "./region.js";

describe("resolveAnthropicVertexRegion", () => {
  it("is a function", () => {
    expect(typeof resolveAnthropicVertexRegion).toBe("function");
  });

  it("returns a non-empty string for empty env", () => {
    const result = resolveAnthropicVertexRegion({});
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("does not throw for empty env", () => {
    expect(() => resolveAnthropicVertexRegion({})).not.toThrow();
  });
});

describe("resolveAnthropicVertexRegionFromBaseUrl", () => {
  it("is a function", () => {
    expect(typeof resolveAnthropicVertexRegionFromBaseUrl).toBe("function");
  });

  it("returns undefined for undefined input", () => {
    expect(resolveAnthropicVertexRegionFromBaseUrl(undefined)).toBeUndefined();
  });

  it("does not throw for undefined input", () => {
    expect(() => resolveAnthropicVertexRegionFromBaseUrl(undefined)).not.toThrow();
  });
});
