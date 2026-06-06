import { describe, expect, it } from "vitest";
import type { PluginManifestRegistry } from "../plugins/manifest-registry.js";
import { detectPluginAutoEnableCandidates } from "./plugin-auto-enable.detect.js";

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
      {
        id: "deepinfra",
        origin: "bundled",
        channels: [],
        providers: [],
        autoEnableWhenConfiguredProviders: ["deepinfra"],
        cliBackends: [],
        skills: [],
        hooks: [],
        rootDir: "/fake/deepinfra",
        source: "/fake/deepinfra/index.js",
        manifestPath: "/fake/deepinfra/coreblow.plugin.json",
      },
    ],
  };
}

describe("detectPluginAutoEnableCandidates", () => {
  it("detects configured channel and provider candidates", () => {
    expect(
      detectPluginAutoEnableCandidates({
        config: {
          channels: { apn: { webhookUrl: "https://example.test" } },
          models: { providers: { deepinfra: { baseUrl: "https://api.deepinfra.example", models: [] } } },
        },
        env: {},
        manifestRegistry: makeRegistry(),
      }),
    ).toEqual(
      expect.arrayContaining([
        { pluginId: "apn-channel", reason: "apn configured" },
        { pluginId: "deepinfra", reason: "deepinfra auth configured" },
      ]),
    );
  });
});
