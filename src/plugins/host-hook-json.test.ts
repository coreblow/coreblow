import { describe, expect, it } from "vitest";
import { isPluginJsonValue, PLUGIN_JSON_VALUE_LIMITS } from "./host-hook-json.js";

describe("isPluginJsonValue", () => {
  it("accepts primitives, arrays, and plain objects", () => {
    expect(isPluginJsonValue(null)).toBe(true);
    expect(isPluginJsonValue(true)).toBe(true);
    expect(isPluginJsonValue(42)).toBe(true);
    expect(isPluginJsonValue("hello")).toBe(true);
    expect(isPluginJsonValue([1, "two", false, null])).toBe(true);
    expect(isPluginJsonValue({ a: 1, b: { c: [2, 3] } })).toBe(true);
  });

  it("rejects non-finite numbers", () => {
    expect(isPluginJsonValue(Number.NaN)).toBe(false);
    expect(isPluginJsonValue(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it("rejects functions, undefined, and non-plain objects", () => {
    expect(isPluginJsonValue(() => {})).toBe(false);
    expect(isPluginJsonValue(undefined)).toBe(false);
    expect(isPluginJsonValue(new Date())).toBe(false);
  });

  it("rejects values deeper than maxDepth", () => {
    let value: unknown = "leaf";
    for (let i = 0; i < PLUGIN_JSON_VALUE_LIMITS.maxDepth + 2; i += 1) {
      value = { nested: value };
    }
    expect(isPluginJsonValue(value)).toBe(false);
  });

  it("rejects strings longer than maxStringLength", () => {
    const longString = "a".repeat(PLUGIN_JSON_VALUE_LIMITS.maxStringLength + 1);
    expect(isPluginJsonValue(longString)).toBe(false);
  });

  it("rejects objects with more keys than maxObjectKeys", () => {
    const wideObject: Record<string, number> = {};
    for (let i = 0; i < PLUGIN_JSON_VALUE_LIMITS.maxObjectKeys + 1; i += 1) {
      wideObject[`key${i}`] = i;
    }
    expect(isPluginJsonValue(wideObject)).toBe(false);
  });

  it("rejects values exceeding the serialized byte budget", () => {
    const bigArray = Array.from({ length: 5000 }, () => "x".repeat(60));
    expect(isPluginJsonValue(bigArray)).toBe(false);
  });
});
