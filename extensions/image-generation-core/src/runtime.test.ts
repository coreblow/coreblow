/**
 * extensions/image-generation-core/src/runtime.test.ts
 * CoreBlow — Image Generation Core Runtime Tests
 */
import { describe, expect, it } from "vitest";
import { listRuntimeImageGenerationProviders } from "./runtime.js";

describe("listRuntimeImageGenerationProviders", () => {
  it("is a function", () => {
    expect(typeof listRuntimeImageGenerationProviders).toBe("function");
  });
  it("returns an array for empty params", () => {
    const result = listRuntimeImageGenerationProviders({});
    expect(Array.isArray(result)).toBe(true);
  });
  it("does not throw for empty params", () => {
    expect(() => listRuntimeImageGenerationProviders({})).not.toThrow();
  });
  it("returns an array for undefined params", () => {
    const result = listRuntimeImageGenerationProviders(undefined);
    expect(Array.isArray(result)).toBe(true);
  });
});
