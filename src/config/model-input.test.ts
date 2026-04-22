/**
 * src/config/model-input.test.ts
 *
 * CoreBlow — Agent Model Input Resolution Tests
 * Verifies resolveAgentModelPrimaryValue, resolveAgentModelFallbackValues,
 * and toAgentModelListLike for string, object, and edge-case inputs.
 */
import { describe, expect, it } from "vitest";
import {
  resolveAgentModelFallbackValues,
  resolveAgentModelPrimaryValue,
  toAgentModelListLike,
} from "./model-input.js";

describe("resolveAgentModelPrimaryValue", () => {
  it("returns string model directly", () => {
    expect(resolveAgentModelPrimaryValue("gpt-4o")).toBe("gpt-4o");
  });

  it("trims whitespace from string model", () => {
    expect(resolveAgentModelPrimaryValue("  gpt-4o  ")).toBe("gpt-4o");
  });

  it("returns undefined for whitespace-only string", () => {
    expect(resolveAgentModelPrimaryValue("   ")).toBeUndefined();
  });

  it("returns object.primary when set", () => {
    expect(resolveAgentModelPrimaryValue({ primary: "claude-3-opus" } as never)).toBe("claude-3-opus");
  });

  it("returns undefined when object.primary is empty", () => {
    expect(resolveAgentModelPrimaryValue({ primary: "" } as never)).toBeUndefined();
  });

  it("returns undefined for undefined input", () => {
    expect(resolveAgentModelPrimaryValue(undefined)).toBeUndefined();
  });

  it("returns undefined for null input", () => {
    expect(resolveAgentModelPrimaryValue(null as never)).toBeUndefined();
  });
});

describe("resolveAgentModelFallbackValues", () => {
  it("returns fallbacks array from object", () => {
    const result = resolveAgentModelFallbackValues({
      fallbacks: ["gpt-4", "claude-2"],
    } as never);
    expect(result).toEqual(["gpt-4", "claude-2"]);
  });

  it("returns empty array for string model (no fallbacks)", () => {
    expect(resolveAgentModelFallbackValues("gpt-4o" as never)).toEqual([]);
  });

  it("returns empty array when fallbacks not set", () => {
    expect(resolveAgentModelFallbackValues({} as never)).toEqual([]);
  });

  it("returns empty array for undefined", () => {
    expect(resolveAgentModelFallbackValues(undefined)).toEqual([]);
  });

  it("returns empty array for null", () => {
    expect(resolveAgentModelFallbackValues(null as never)).toEqual([]);
  });
});

describe("toAgentModelListLike", () => {
  it("returns {primary} for string model", () => {
    expect(toAgentModelListLike("gpt-4o" as never)).toEqual({ primary: "gpt-4o" });
  });

  it("returns undefined for empty string", () => {
    expect(toAgentModelListLike("" as never)).toBeUndefined();
  });

  it("returns the object as-is for object model", () => {
    const model = { primary: "gpt-4o", fallbacks: ["gpt-4"] } as never;
    expect(toAgentModelListLike(model)).toBe(model);
  });

  it("returns undefined for undefined", () => {
    expect(toAgentModelListLike(undefined)).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(toAgentModelListLike(null as never)).toBeUndefined();
  });
});
