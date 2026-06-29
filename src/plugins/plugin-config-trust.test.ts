import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import type { PluginManifestRecord } from "./manifest-registry.js";
import { isWorkspacePluginAllowedByConfig, normalizePluginConfigId } from "./plugin-config-trust.js";

function makePlugin(id: string): PluginManifestRecord {
  return {
    id,
    channels: [],
    providers: [],
    cliBackends: [],
    skills: [],
    hooks: [],
    origin: "workspace",
    rootDir: "/tmp/workspace-plugin",
    source: "workspace",
    manifestPath: "/tmp/workspace-plugin/coreblow.plugin.json",
  };
}

describe("normalizePluginConfigId", () => {
  it("lowercases string ids", () => {
    expect(normalizePluginConfigId("Workspace-Helper")).toBe("workspace-helper");
  });

  it("returns an empty string for non-string input", () => {
    expect(normalizePluginConfigId(undefined)).toBe("");
    expect(normalizePluginConfigId(null)).toBe("");
    expect(normalizePluginConfigId(42)).toBe("");
    expect(normalizePluginConfigId({})).toBe("");
  });
});

describe("isWorkspacePluginAllowedByConfig", () => {
  it("denies everything when plugins are globally disabled", () => {
    const config: CoreBlowConfig = { plugins: { enabled: false, allow: ["workspace-helper"] } };
    expect(
      isWorkspacePluginAllowedByConfig({ config, plugin: makePlugin("workspace-helper") }),
    ).toBe(false);
  });

  it("denies a plugin with no resolvable id", () => {
    const config: CoreBlowConfig = { plugins: { allow: [""] } };
    expect(isWorkspacePluginAllowedByConfig({ config, plugin: makePlugin("") })).toBe(false);
  });

  it("denies a plugin on the denylist even if also on the allowlist", () => {
    const config: CoreBlowConfig = {
      plugins: { allow: ["workspace-helper"], deny: ["workspace-helper"] },
    };
    expect(
      isWorkspacePluginAllowedByConfig({ config, plugin: makePlugin("workspace-helper") }),
    ).toBe(false);
  });

  it("denies a plugin with entries[id].enabled === false, even if on the allowlist", () => {
    const config: CoreBlowConfig = {
      plugins: {
        allow: ["workspace-helper"],
        entries: { "workspace-helper": { enabled: false } },
      },
    };
    expect(
      isWorkspacePluginAllowedByConfig({ config, plugin: makePlugin("workspace-helper") }),
    ).toBe(false);
  });

  it("allows a plugin with entries[id].enabled === true even without an allowlist entry", () => {
    const config: CoreBlowConfig = {
      plugins: { entries: { "workspace-helper": { enabled: true } } },
    };
    expect(
      isWorkspacePluginAllowedByConfig({ config, plugin: makePlugin("workspace-helper") }),
    ).toBe(true);
  });

  it("allows a plugin explicitly present on the allowlist", () => {
    const config: CoreBlowConfig = { plugins: { allow: ["workspace-helper"] } };
    expect(
      isWorkspacePluginAllowedByConfig({ config, plugin: makePlugin("workspace-helper") }),
    ).toBe(true);
  });

  it("matches allow/deny/entries lookups case-insensitively", () => {
    const config: CoreBlowConfig = { plugins: { allow: ["Workspace-Helper"] } };
    expect(
      isWorkspacePluginAllowedByConfig({ config, plugin: makePlugin("workspace-helper") }),
    ).toBe(true);
  });

  it("falls back to isImplicitlyAllowed when no entry or allowlist match exists", () => {
    const config: CoreBlowConfig = { plugins: {} };
    expect(
      isWorkspacePluginAllowedByConfig({
        config,
        plugin: makePlugin("workspace-helper"),
        isImplicitlyAllowed: (id) => id === "workspace-helper",
      }),
    ).toBe(true);
  });

  it("denies by default when no entry, allowlist match, or isImplicitlyAllowed callback says yes", () => {
    const config: CoreBlowConfig = { plugins: {} };
    expect(
      isWorkspacePluginAllowedByConfig({ config, plugin: makePlugin("workspace-helper") }),
    ).toBe(false);
  });

  it("treats an undefined config as plugins enabled with no allow/deny/entries", () => {
    expect(
      isWorkspacePluginAllowedByConfig({ config: undefined, plugin: makePlugin("workspace-helper") }),
    ).toBe(false);
  });
});
