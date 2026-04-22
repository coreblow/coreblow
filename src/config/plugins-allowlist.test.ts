/**
 * src/config/plugins-allowlist.test.ts
 *
 * CoreBlow — Plugin Allowlist Tests
 * Verifies ensurePluginAllowlisted idempotency, append behavior,
 * and edge cases with undefined or non-array plugin.allow config.
 */
import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "./config.js";
import { ensurePluginAllowlisted } from "./plugins-allowlist.js";

function makeCfg(allow?: string[]): CoreBlowConfig {
  return {
    plugins: allow !== undefined ? { allow } : {},
  } as CoreBlowConfig;
}

describe("ensurePluginAllowlisted", () => {
  it("adds pluginId to allow list when not present", () => {
    const cfg = makeCfg(["plugin-a"]);
    const result = ensurePluginAllowlisted(cfg, "plugin-b");
    expect(result.plugins?.allow).toContain("plugin-b");
    expect(result.plugins?.allow).toContain("plugin-a");
  });

  it("is idempotent — does not duplicate existing pluginId", () => {
    const cfg = makeCfg(["plugin-a", "plugin-b"]);
    const result = ensurePluginAllowlisted(cfg, "plugin-a");
    const count = result.plugins?.allow?.filter((id) => id === "plugin-a").length;
    expect(count).toBe(1);
  });

  it("returns same config reference when pluginId already allowed", () => {
    const cfg = makeCfg(["plugin-a"]);
    const result = ensurePluginAllowlisted(cfg, "plugin-a");
    expect(result).toBe(cfg);
  });

  it("returns same config when allow is not an array (undefined)", () => {
    const cfg = makeCfg(undefined);
    const result = ensurePluginAllowlisted(cfg, "plugin-x");
    expect(result).toBe(cfg);
  });

  it("does not mutate original config", () => {
    const cfg = makeCfg(["plugin-a"]);
    const originalAllow = [...(cfg.plugins?.allow ?? [])];
    ensurePluginAllowlisted(cfg, "plugin-b");
    expect(cfg.plugins?.allow).toEqual(originalAllow);
  });

  it("handles empty allow list by appending pluginId", () => {
    const cfg = makeCfg([]);
    const result = ensurePluginAllowlisted(cfg, "plugin-new");
    expect(result.plugins?.allow).toEqual(["plugin-new"]);
  });

  it("preserves other config properties unchanged", () => {
    const cfg = {
      ...makeCfg(["plugin-a"]),
      talk: { model: "gpt-4o" },
    } as CoreBlowConfig;
    const result = ensurePluginAllowlisted(cfg, "plugin-b");
    expect((result as typeof cfg).talk).toEqual({ model: "gpt-4o" });
  });
});
