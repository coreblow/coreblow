/**
 * extensions/fal/onboard.test.ts
 *
 * CoreBlow — Fal Extension Onboard Tests
 * Verifies FAL_DEFAULT_IMAGE_MODEL_REF constant and applyFalConfig function.
 */
import { describe, expect, it } from "vitest";
import { FAL_DEFAULT_IMAGE_MODEL_REF, applyFalConfig } from "./onboard.js";

describe("Fal onboard constants", () => {
  it("FAL_DEFAULT_IMAGE_MODEL_REF is a non-empty string", () => {
    expect(typeof FAL_DEFAULT_IMAGE_MODEL_REF).toBe("string");
    expect(FAL_DEFAULT_IMAGE_MODEL_REF.length).toBeGreaterThan(0);
  });

  it("FAL_DEFAULT_IMAGE_MODEL_REF starts with fal/", () => {
    expect(FAL_DEFAULT_IMAGE_MODEL_REF.startsWith("fal/")).toBe(true);
  });

  it("FAL_DEFAULT_IMAGE_MODEL_REF contains fal-ai", () => {
    expect(FAL_DEFAULT_IMAGE_MODEL_REF).toContain("fal-ai");
  });
});

describe("applyFalConfig", () => {
  it("is a function", () => {
    expect(typeof applyFalConfig).toBe("function");
  });

  it("returns an object for empty config", () => {
    const result = applyFalConfig({} as never);
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("does not throw for empty config", () => {
    expect(() => applyFalConfig({} as never)).not.toThrow();
  });
});
