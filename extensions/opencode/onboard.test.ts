/**
 * extensions/opencode/onboard.test.ts
 *
 * CoreBlow — OpenCode Extension Onboard Tests
 * Verifies OPENCODE_ZEN_DEFAULT_MODEL_REF and apply config functions.
 */
import { describe, expect, it } from "vitest";
import {
  OPENCODE_ZEN_DEFAULT_MODEL_REF,
  applyOpencodeZenConfig,
  applyOpencodeZenProviderConfig,
} from "./onboard.js";

describe("OpenCode onboard constants", () => {
  it("OPENCODE_ZEN_DEFAULT_MODEL_REF is a non-empty string", () => {
    expect(typeof OPENCODE_ZEN_DEFAULT_MODEL_REF).toBe("string");
    expect(OPENCODE_ZEN_DEFAULT_MODEL_REF.length).toBeGreaterThan(0);
  });

  it("OPENCODE_ZEN_DEFAULT_MODEL_REF starts with opencode/", () => {
    expect(OPENCODE_ZEN_DEFAULT_MODEL_REF.startsWith("opencode/")).toBe(true);
  });
});

describe("applyOpencodeZenProviderConfig", () => {
  it("is a function", () => {
    expect(typeof applyOpencodeZenProviderConfig).toBe("function");
  });

  it("returns object for empty config", () => {
    const result = applyOpencodeZenProviderConfig({} as never);
    expect(typeof result).toBe("object");
  });

  it("does not throw for empty config", () => {
    expect(() => applyOpencodeZenProviderConfig({} as never)).not.toThrow();
  });
});

describe("applyOpencodeZenConfig", () => {
  it("is a function", () => {
    expect(typeof applyOpencodeZenConfig).toBe("function");
  });

  it("does not throw for empty config", () => {
    expect(() => applyOpencodeZenConfig({} as never)).not.toThrow();
  });
});
