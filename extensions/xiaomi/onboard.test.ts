/**
 * extensions/xiaomi/onboard.test.ts
 *
 * CoreBlow — Xiaomi Extension Onboard Tests
 * Verifies XIAOMI_DEFAULT_MODEL_REF and apply config functions.
 */
import { describe, expect, it } from "vitest";
import {
  XIAOMI_DEFAULT_MODEL_REF,
  applyXiaomiConfig,
  applyXiaomiProviderConfig,
} from "./onboard.js";

describe("Xiaomi onboard constants", () => {
  it("XIAOMI_DEFAULT_MODEL_REF is a non-empty string", () => {
    expect(typeof XIAOMI_DEFAULT_MODEL_REF).toBe("string");
    expect(XIAOMI_DEFAULT_MODEL_REF.length).toBeGreaterThan(0);
  });

  it("XIAOMI_DEFAULT_MODEL_REF starts with xiaomi/", () => {
    expect(XIAOMI_DEFAULT_MODEL_REF.startsWith("xiaomi/")).toBe(true);
  });
});

describe("applyXiaomiProviderConfig", () => {
  it("is a function", () => {
    expect(typeof applyXiaomiProviderConfig).toBe("function");
  });

  it("returns object for empty config", () => {
    const result = applyXiaomiProviderConfig({} as never);
    expect(typeof result).toBe("object");
  });

  it("does not throw for empty config", () => {
    expect(() => applyXiaomiProviderConfig({} as never)).not.toThrow();
  });
});

describe("applyXiaomiConfig", () => {
  it("is a function", () => {
    expect(typeof applyXiaomiConfig).toBe("function");
  });

  it("does not throw for empty config", () => {
    expect(() => applyXiaomiConfig({} as never)).not.toThrow();
  });
});
