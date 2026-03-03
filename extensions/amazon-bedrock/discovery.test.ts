/**
 * extensions/amazon-bedrock/discovery.test.ts
 * CoreBlow — Amazon Bedrock Extension Discovery Tests
 */
import { describe, expect, it } from "vitest";
import {
  resetBedrockDiscoveryCacheForTest,
  resolveBedrockConfigApiKey,
} from "./discovery.js";

describe("resetBedrockDiscoveryCacheForTest", () => {
  it("is a function", () => {
    expect(typeof resetBedrockDiscoveryCacheForTest).toBe("function");
  });
  it("does not throw", () => {
    expect(() => resetBedrockDiscoveryCacheForTest()).not.toThrow();
  });
});

describe("resolveBedrockConfigApiKey", () => {
  it("is a function", () => {
    expect(typeof resolveBedrockConfigApiKey).toBe("function");
  });
  it("returns a string for empty env", () => {
    const result = resolveBedrockConfigApiKey({});
    expect(typeof result).toBe("string");
  });
  it("does not throw for empty env", () => {
    expect(() => resolveBedrockConfigApiKey({})).not.toThrow();
  });
});
