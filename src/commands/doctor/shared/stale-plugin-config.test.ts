import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../../../config/config.js";
import type { PluginManifestRecord } from "../../../plugins/manifest-registry.js";
import * as manifestRegistry from "../../../plugins/manifest-registry.js";
import {
  collectStalePluginConfigWarnings,
  maybeRepairStalePluginConfig,
  scanStalePluginConfig,
} from "./stale-plugin-config.js";

function manifest(id: string): PluginManifestRecord {
  return {
    id,
    channels: [],
    providers: [],
    cliBackends: [],
    skills: [],
    hooks: [],
    origin: "bundled",
    rootDir: `/plugins/${id}`,
    source: `/plugins/${id}`,
    manifestPath: `/plugins/${id}/coreblow.plugin.json`,
  };
}

describe("doctor stale plugin config helpers", () => {
  beforeEach(() => {
    vi.spyOn(manifestRegistry, "loadPluginManifestRegistry").mockReturnValue({
      plugins: [manifest("discord"), manifest("voice-call"), manifest("openai")],
      diagnostics: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("finds stale plugins.allow and plugins.entries refs", () => {
    const hits = scanStalePluginConfig({
      plugins: {
        allow: ["discord", "acp"],
        entries: {
          "voice-call": { enabled: true },
          acp: { enabled: true },
        },
      },
    } as CoreBlowConfig);

    expect(hits).toEqual([
      {
        pluginId: "acp",
        pathLabel: "plugins.allow",
        surface: "allow",
      },
      {
        pluginId: "acp",
        pathLabel: "plugins.entries.acp",
        surface: "entries",
      },
    ]);
  });

  it("removes stale plugin ids from allow and entries without changing valid refs", () => {
    const result = maybeRepairStalePluginConfig({
      plugins: {
        allow: ["discord", "acp", "voice-call"],
        entries: {
          "voice-call": { enabled: true },
          acp: { enabled: true },
        },
      },
    } as CoreBlowConfig);

    expect(result.changes).toEqual([
      "- plugins.allow: removed 1 stale plugin id (acp)",
      "- plugins.entries: removed 1 stale plugin entry (acp)",
    ]);
    expect(result.config.plugins?.allow).toEqual(["discord", "voice-call"]);
    expect(result.config.plugins?.entries).toEqual({
      "voice-call": { enabled: true },
    });
  });

  it("formats stale plugin warnings with a doctor hint", () => {
    const warnings = collectStalePluginConfigWarnings({
      hits: [
        {
          pluginId: "acp",
          pathLabel: "plugins.allow",
          surface: "allow",
        },
      ],
      doctorFixCommand: "coreblow doctor --fix",
    });

    expect(warnings).toEqual([
      expect.stringContaining('plugins.allow: stale plugin reference "acp"'),
      expect.stringContaining('Run "coreblow doctor --fix"'),
    ]);
  });

  it("does not auto-repair stale refs while plugin discovery has errors", () => {
    vi.spyOn(manifestRegistry, "loadPluginManifestRegistry").mockReturnValue({
      plugins: [],
      diagnostics: [
        { level: "error", message: "plugin path not found: /missing", source: "/missing" },
      ],
    });

    const cfg = {
      plugins: {
        allow: ["acp"],
        entries: {
          acp: { enabled: true },
        },
      },
    } as CoreBlowConfig;

    const hits = scanStalePluginConfig(cfg);
    expect(hits).toEqual([
      {
        pluginId: "acp",
        pathLabel: "plugins.allow",
        surface: "allow",
      },
      {
        pluginId: "acp",
        pathLabel: "plugins.entries.acp",
        surface: "entries",
      },
    ]);

    const result = maybeRepairStalePluginConfig(cfg);
    expect(result.changes).toEqual([]);
    expect(result.config).toEqual(cfg);

    const warnings = collectStalePluginConfigWarnings({
      hits,
      doctorFixCommand: "coreblow doctor --fix",
      autoRepairBlocked: true,
    });
    expect(warnings[2]).toContain("Auto-removal is paused");
  });

  it("treats legacy plugin aliases as valid ids during scan and repair", () => {
    const cfg = {
      plugins: {
        allow: ["openai-codex", "acp"],
        entries: {
          "openai-codex": { enabled: true },
          acp: { enabled: true },
        },
      },
    } as CoreBlowConfig;

    expect(scanStalePluginConfig(cfg)).toEqual([
      {
        pluginId: "acp",
        pathLabel: "plugins.allow",
        surface: "allow",
      },
      {
        pluginId: "acp",
        pathLabel: "plugins.entries.acp",
        surface: "entries",
      },
    ]);

    const result = maybeRepairStalePluginConfig(cfg);
    expect(result.config.plugins?.allow).toEqual(["openai-codex"]);
    expect(result.config.plugins?.entries).toEqual({
      "openai-codex": { enabled: true },
    });
  });
});
