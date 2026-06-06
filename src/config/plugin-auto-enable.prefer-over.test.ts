import { describe, expect, it } from "vitest";
import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";
import { shouldSkipPreferredPluginAutoEnable } from "./plugin-auto-enable.prefer-over.js";

const registry: PluginManifestRegistry = {
  diagnostics: [],
  plugins: [
    {
      id: "preferred-channel",
      origin: "config",
      channels: ["preferred-channel"],
      providers: [],
      cliBackends: [],
      skills: [],
      hooks: [],
      channelCatalogMeta: { id: "preferred-channel", preferOver: ["legacy-channel"] },
      rootDir: "/fake/preferred-channel",
      source: "/fake/preferred-channel/index.js",
      manifestPath: "/fake/preferred-channel/coreblow.plugin.json",
    },
  ],
};

describe("plugin auto-enable prefer-over facade", () => {
  it("skips a candidate when a configured preferred plugin supersedes it", () => {
    expect(
      shouldSkipPreferredPluginAutoEnable(
        {},
        { pluginId: "legacy-channel", reason: "legacy configured" },
        [
          { pluginId: "preferred-channel", reason: "preferred configured" },
          { pluginId: "legacy-channel", reason: "legacy configured" },
        ],
        {},
        registry,
      ),
    ).toBe(true);
  });
});
