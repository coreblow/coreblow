/**
 * extensions/kimi-coding/onboard.test.ts
 *
 * CoreBlow — Kimi Coding Extension Onboard Tests
 * Verifies KIMI_MODEL_REF and applyKimiCode config functions.
 */
import { describe, expect, it } from "vitest";
import {
  KIMI_CODING_MODEL_REF,
  KIMI_MODEL_REF,
  applyKimiCodeConfig,
  applyKimiCodeProviderConfig,
} from "./onboard.js";

describe("Kimi coding model ref constants", () => {
  it("KIMI_MODEL_REF is a non-empty string", () => {
    expect(typeof KIMI_MODEL_REF).toBe("string");
    expect(KIMI_MODEL_REF.length).toBeGreaterThan(0);
  });

  it("KIMI_MODEL_REF starts with kimi/", () => {
    expect(KIMI_MODEL_REF.startsWith("kimi/")).toBe(true);
  });

  it("KIMI_CODING_MODEL_REF equals KIMI_MODEL_REF", () => {
    expect(KIMI_CODING_MODEL_REF).toBe(KIMI_MODEL_REF);
  });
});

describe("applyKimiCodeProviderConfig", () => {
  it("is a function", () => {
    expect(typeof applyKimiCodeProviderConfig).toBe("function");
  });

  it("returns an object for empty config", () => {
    const result = applyKimiCodeProviderConfig({} as never);
    expect(typeof result).toBe("object");
  });

  it("does not throw for empty config", () => {
    expect(() => applyKimiCodeProviderConfig({} as never)).not.toThrow();
  });
});

describe("applyKimiCodeConfig", () => {
  it("is a function", () => {
    expect(typeof applyKimiCodeConfig).toBe("function");
  });

  it("returns an object for empty config", () => {
    const result = applyKimiCodeConfig({} as never);
    expect(typeof result).toBe("object");
  });

  it("does not throw for empty config", () => {
    expect(() => applyKimiCodeConfig({} as never)).not.toThrow();
  });
});
