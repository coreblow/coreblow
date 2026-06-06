import { describe, expect, it } from "vitest";
import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";
import { applyPluginAutoEnable } from "./plugin-auto-enable.apply.js";

function makeRegistry(): PluginManifestRegistry {
  return {
    diagnostics: [],
    plugins: [
      {
        id: "apn-channel",
        origin: "config",
        channels: ["apn"],
        providers: [],
        cliBackends: [],
        skills: [],
        hooks: [],
        rootDir: "/fake/apn-channel",
        source: "/fake/apn-channel/index.js",
        manifestPath: "/fake/apn-channel/coreblow.plugin.json",
      },
    ],
  };
}

describe("plugin auto-enable apply facade", () => {
  it("applies auto-enable through the CoreBlow implementation", () => {
    const result = applyPluginAutoEnable({
      config: { channels: { apn: { webhookUrl: "https://example.test" } } },
      env: {},
      manifestRegistry: makeRegistry(),
    });

    expect(result.config.plugins?.entries?.["apn-channel"]?.enabled).toBe(true);
    expect(result.config.plugins?.allow).toBeUndefined();
    expect(result.changes).toEqual(["apn configured, enabled automatically."]);
  });
});
