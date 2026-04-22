/**
 * extensions/opencode-go/onboard.test.ts
 *
 * CoreBlow — OpenCode-Go Extension Onboard Tests
 * Verifies OPENCODE_GO_DEFAULT_MODEL_REF and apply config functions.
 */
import { describe, expect, it } from "vitest";
import {
  OPENCODE_GO_DEFAULT_MODEL_REF,
  applyOpencodeGoConfig,
  applyOpencodeGoProviderConfig,
} from "./onboard.js";

describe("OpenCode-Go onboard constants", () => {
  it("OPENCODE_GO_DEFAULT_MODEL_REF is a non-empty string", () => {
    expect(typeof OPENCODE_GO_DEFAULT_MODEL_REF).toBe("string");
    expect(OPENCODE_GO_DEFAULT_MODEL_REF.length).toBeGreaterThan(0);
  });

  it("OPENCODE_GO_DEFAULT_MODEL_REF starts with opencode-go/", () => {
    expect(OPENCODE_GO_DEFAULT_MODEL_REF.startsWith("opencode-go/")).toBe(true);
  });
});

describe("applyOpencodeGoProviderConfig", () => {
  it("is a function", () => {
    expect(typeof applyOpencodeGoProviderConfig).toBe("function");
  });

  it("returns object for empty config", () => {
    const result = applyOpencodeGoProviderConfig({} as never);
    expect(typeof result).toBe("object");
  });

  it("does not throw for empty config", () => {
    expect(() => applyOpencodeGoProviderConfig({} as never)).not.toThrow();
  });
});

describe("applyOpencodeGoConfig", () => {
  it("is a function", () => {
    expect(typeof applyOpencodeGoConfig).toBe("function");
  });

  it("does not throw for empty config", () => {
    expect(() => applyOpencodeGoConfig({} as never)).not.toThrow();
  });
});
