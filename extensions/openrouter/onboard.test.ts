/**
 * extensions/openrouter/onboard.test.ts
 *
 * CoreBlow — OpenRouter Extension Onboard Tests
 * Verifies OPENROUTER_DEFAULT_MODEL_REF and applyOpenrouterConfig functions.
 */
import { describe, expect, it } from "vitest";
import {
  OPENROUTER_DEFAULT_MODEL_REF,
  applyOpenrouterConfig,
  applyOpenrouterProviderConfig,
} from "./onboard.js";

describe("OpenRouter onboard constants", () => {
  it("OPENROUTER_DEFAULT_MODEL_REF is a non-empty string", () => {
    expect(typeof OPENROUTER_DEFAULT_MODEL_REF).toBe("string");
    expect(OPENROUTER_DEFAULT_MODEL_REF.length).toBeGreaterThan(0);
  });

  it("OPENROUTER_DEFAULT_MODEL_REF starts with openrouter/", () => {
    expect(OPENROUTER_DEFAULT_MODEL_REF.startsWith("openrouter/")).toBe(true);
  });
});

describe("applyOpenrouterProviderConfig", () => {
  it("is a function", () => {
    expect(typeof applyOpenrouterProviderConfig).toBe("function");
  });

  it("returns object for empty config", () => {
    const result = applyOpenrouterProviderConfig({} as never);
    expect(typeof result).toBe("object");
    expect(result).not.toBeNull();
  });

  it("does not throw for empty config", () => {
    expect(() => applyOpenrouterProviderConfig({} as never)).not.toThrow();
  });
});

describe("applyOpenrouterConfig", () => {
  it("is a function", () => {
    expect(typeof applyOpenrouterConfig).toBe("function");
  });

  it("does not throw for empty config", () => {
    expect(() => applyOpenrouterConfig({} as never)).not.toThrow();
  });

  it("returns an object", () => {
    const result = applyOpenrouterConfig({} as never);
    expect(typeof result).toBe("object");
  });
});
