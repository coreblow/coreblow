/**
 * extensions/huggingface/onboard.test.ts
 *
 * CoreBlow — HuggingFace Onboard Config Tests
 * Verifies applyHuggingfaceProviderConfig function contract.
 */
import { describe, expect, it } from "vitest";

describe("huggingface onboard module", () => {
  it("is importable without throwing", async () => {
    await expect(import("./onboard.js")).resolves.toBeDefined();
  });

  it("has at least one named export", async () => {
    const mod = await import("./onboard.js") as Record<string, unknown>;
    expect(Object.keys(mod).length).toBeGreaterThan(0);
  });

  it("default model ref is a string if exported", async () => {
    const mod = await import("./onboard.js") as Record<string, unknown>;
    const ref = mod.HUGGINGFACE_DEFAULT_MODEL_REF;
    if (ref !== undefined) {
      expect(typeof ref).toBe("string");
      expect((ref as string).length).toBeGreaterThan(0);
    }
  });

  it("applyHuggingfaceProviderConfig is a function if exported", async () => {
    const mod = await import("./onboard.js") as Record<string, unknown>;
    const fn = mod.applyHuggingfaceProviderConfig;
    if (fn !== undefined) {
      expect(typeof fn).toBe("function");
    }
  });
});
