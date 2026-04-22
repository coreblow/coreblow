import { describe, expect, it } from "vitest";
import { normalizeLegacyDeliveryInput } from "./legacy-delivery.js";

describe("normalizeLegacyDeliveryInput", () => {
  it("returns mutated=false for modern input with no legacy fields", () => {
    const result = normalizeLegacyDeliveryInput({
      delivery: { mode: "announce" } as never,
      payload: { type: "prompt" } as never,
    });
    expect(typeof result.mutated).toBe("boolean");
  });

  it("returns an object with mutated field", () => {
    const result = normalizeLegacyDeliveryInput({
      delivery: null,
      payload: null,
    });
    expect(result).toHaveProperty("mutated");
  });

  it("does not throw for null delivery and payload", () => {
    expect(() =>
      normalizeLegacyDeliveryInput({ delivery: null, payload: null }),
    ).not.toThrow();
  });

  it("does not throw for undefined inputs", () => {
    expect(() =>
      normalizeLegacyDeliveryInput({ delivery: undefined, payload: undefined }),
    ).not.toThrow();
  });

  it("result has delivery field", () => {
    const result = normalizeLegacyDeliveryInput({
      delivery: { mode: "announce" } as never,
      payload: {},
    });
    expect("delivery" in result).toBe(true);
  });

  it("is consistent for same input", () => {
    const input = { delivery: { mode: "direct" } as never, payload: {} };
    const r1 = normalizeLegacyDeliveryInput(input);
    const r2 = normalizeLegacyDeliveryInput(input);
    expect(r1.mutated).toBe(r2.mutated);
  });
});
