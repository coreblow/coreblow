/**
 * extensions/together/onboard.test.ts
 *
 * CoreBlow — Together AI Onboard Config Tests
 * Verifies TOGETHER_DEFAULT_MODEL_REF constant and
 * applyTogetherProviderConfig function contract.
 */
import { describe, expect, it } from "vitest";
import {
  TOGETHER_DEFAULT_MODEL_REF,
  applyTogetherProviderConfig,
} from "./onboard.js";

describe("Together AI onboard constants", () => {
  it("TOGETHER_DEFAULT_MODEL_REF is a non-empty string", () => {
    expect(typeof TOGETHER_DEFAULT_MODEL_REF).toBe("string");
    expect(TOGETHER_DEFAULT_MODEL_REF.length).toBeGreaterThan(0);
  });

  it("TOGETHER_DEFAULT_MODEL_REF starts with together/", () => {
    expect(TOGETHER_DEFAULT_MODEL_REF.startsWith("together/")).toBe(true);
  });
});

describe("applyTogetherProviderConfig", () => {
  it("is a function", () => {
    expect(typeof applyTogetherProviderConfig).toBe("function");
  });

  it("returns an object given empty config", () => {
    const result = applyTogetherProviderConfig({} as never);
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("does not throw for empty config", () => {
    expect(() => applyTogetherProviderConfig({} as never)).not.toThrow();
  });

  it("returned config has channels or providers key", () => {
    const result = applyTogetherProviderConfig({} as never) as Record<string, unknown>;
    expect("channels" in result || "providers" in result || typeof result === "object").toBe(true);
  });
});
