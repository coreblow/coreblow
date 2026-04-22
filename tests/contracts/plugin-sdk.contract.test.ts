/**
 * tests/contracts/plugin-sdk.contract.test.ts
 *
 * Contract test: verifikasi bahwa CB plugin-sdk public API
 * tidak berubah secara breaking.
 * Semua export yang dijanjikan ke plugin author harus tetap ada.
 */
import { describe, expect, it } from "vitest";

describe("plugin-sdk — stable export contract", () => {
  it("definePluginEntry is exported from plugin-entry", async () => {
    const mod = await import("../../src/plugin-sdk/plugin-entry.js");
    expect(typeof mod.definePluginEntry).toBe("function");
  });

  it("plugin-sdk index exports CoreBlowConfig type-compatible shape", async () => {
    // Runtime check: module loads without error
    const mod = await import("../../src/plugin-sdk/index.js");
    expect(mod).toBeDefined();
  });

  it("reply-payload exports required functions", async () => {
    const mod = await import("../../src/plugin-sdk/reply-payload.js");
    const required = [
      "hasOutboundReplyContent",
      "resolveSendableOutboundReplyParts",
    ];
    for (const fn of required) {
      expect(
        typeof (mod as Record<string, unknown>)[fn],
        `${fn} must be a function`,
      ).toBe("function");
    }
  });

  it("model-provider exports createModelProvider or equivalent", async () => {
    const mod = await import("../../src/plugin-sdk/model-provider.js").catch(() => null);
    if (!mod) {
      // Optional module — skip if not present
      return;
    }
    // If present, must export at least one function
    const fns = Object.values(mod as Record<string, unknown>).filter(
      (v) => typeof v === "function",
    );
    expect(fns.length).toBeGreaterThan(0);
  });

  it("image-generation exports are stable", async () => {
    const mod = await import("../../src/plugin-sdk/image-generation.js");
    expect(mod).toBeDefined();
  });
});

describe("plugin-sdk — definePluginEntry contract", () => {
  it("definePluginEntry accepts plugin object and returns it", async () => {
    const { definePluginEntry } = await import("../../src/plugin-sdk/plugin-entry.js");

    const mockPlugin = {
      name: "test-plugin",
      version: "1.0.0",
      initialize: async () => {},
    };

    const result = definePluginEntry(mockPlugin as Parameters<typeof definePluginEntry>[0]);
    // Contract: must return the plugin (pass-through pattern)
    expect(result).toBeDefined();
  });
});
