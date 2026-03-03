/**
 * extensions/moonshot/onboard.test.ts
 *
 * CoreBlow — Moonshot Onboard Config Tests
 * Verifies MOONSHOT_DEFAULT_MODEL_REF and applyMoonshotConfig functions.
 */
import { describe, expect, it } from "vitest";
import {
  MOONSHOT_DEFAULT_MODEL_REF,
  applyMoonshotConfig,
  applyMoonshotProviderConfig,
} from "./onboard.js";

describe("Moonshot onboard constants", () => {
  it("MOONSHOT_DEFAULT_MODEL_REF is a non-empty string", () => {
    expect(typeof MOONSHOT_DEFAULT_MODEL_REF).toBe("string");
    expect(MOONSHOT_DEFAULT_MODEL_REF.length).toBeGreaterThan(0);
  });

  it("MOONSHOT_DEFAULT_MODEL_REF starts with moonshot/", () => {
    expect(MOONSHOT_DEFAULT_MODEL_REF.startsWith("moonshot/")).toBe(true);
  });
});

describe("applyMoonshotProviderConfig", () => {
  it("is a function", () => {
    expect(typeof applyMoonshotProviderConfig).toBe("function");
  });

  it("returns an object for empty config", () => {
    const result = applyMoonshotProviderConfig({} as never);
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("does not throw for empty config", () => {
    expect(() => applyMoonshotProviderConfig({} as never)).not.toThrow();
  });
});

describe("applyMoonshotConfig", () => {
  it("is a function", () => {
    expect(typeof applyMoonshotConfig).toBe("function");
  });

  it("does not throw for empty config", () => {
    expect(() => applyMoonshotConfig({} as never)).not.toThrow();
  });

  it("returns an object", () => {
    const result = applyMoonshotConfig({} as never);
    expect(typeof result).toBe("object");
  });
});
