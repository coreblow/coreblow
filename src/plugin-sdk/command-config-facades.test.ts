import { describe, expect, it, vi } from "vitest";
import { normalizeCommandBody } from "./command-surface.js";
import { createDirectDmPreCryptoGuardPolicy } from "./direct-dm-guard-policy.js";
import { createCachedLazyValueGetter } from "./lazy-value.js";

describe("plugin SDK command and config facades", () => {
  it("exposes command normalization and policy defaults", () => {
    expect(normalizeCommandBody("/STATUS")).toBe("/status");
    expect(createDirectDmPreCryptoGuardPolicy().maxCiphertextBytes).toBe(16 * 1024);
  });

  it("resolves lazy values once", () => {
    const factory = vi.fn(() => "ready");
    const getValue = createCachedLazyValueGetter(factory);

    expect(getValue()).toBe("ready");
    expect(getValue()).toBe("ready");
    expect(factory).toHaveBeenCalledOnce();
  });
});
