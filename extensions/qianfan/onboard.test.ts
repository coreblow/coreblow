/**
 * extensions/qianfan/onboard.test.ts
 *
 * CoreBlow — Qianfan Extension Onboard Tests
 * Verifies QIANFAN_DEFAULT_MODEL_REF and apply config functions.
 */
import { describe, expect, it } from "vitest";
import {
  QIANFAN_DEFAULT_MODEL_REF,
  applyQianfanConfig,
  applyQianfanProviderConfig,
} from "./onboard.js";

describe("Qianfan onboard constants", () => {
  it("QIANFAN_DEFAULT_MODEL_REF is a non-empty string", () => {
    expect(typeof QIANFAN_DEFAULT_MODEL_REF).toBe("string");
    expect(QIANFAN_DEFAULT_MODEL_REF.length).toBeGreaterThan(0);
  });

  it("QIANFAN_DEFAULT_MODEL_REF starts with qianfan/", () => {
    expect(QIANFAN_DEFAULT_MODEL_REF.startsWith("qianfan/")).toBe(true);
  });
});

describe("applyQianfanProviderConfig", () => {
  it("is a function", () => {
    expect(typeof applyQianfanProviderConfig).toBe("function");
  });

  it("returns object for empty config", () => {
    const result = applyQianfanProviderConfig({} as never);
    expect(typeof result).toBe("object");
  });

  it("does not throw for empty config", () => {
    expect(() => applyQianfanProviderConfig({} as never)).not.toThrow();
  });
});

describe("applyQianfanConfig", () => {
  it("is a function", () => {
    expect(typeof applyQianfanConfig).toBe("function");
  });

  it("does not throw for empty config", () => {
    expect(() => applyQianfanConfig({} as never)).not.toThrow();
  });
});
