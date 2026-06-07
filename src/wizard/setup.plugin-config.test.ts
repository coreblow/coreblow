import { describe, expect, it, vi } from "vitest";
import type { PluginConfigUiHint } from "../plugins/types.js";
import type { WizardPrompter } from "./prompts.js";
import {
  discoverConfigurablePlugins,
  discoverUnconfiguredPlugins,
  setupPluginConfig,
} from "./setup.plugin-config.js";

function makeManifestPlugin(
  id: string,
  uiHints?: Record<string, PluginConfigUiHint>,
  configSchema?: Record<string, unknown>,
) {
  return {
    id,
    name: id,
    configUiHints: uiHints,
    configSchema,
    enabled: true,
    enabledByDefault: true,
  };
}

describe("discoverConfigurablePlugins", () => {
  it("returns plugins with non-advanced uiHints", () => {
    const result = discoverConfigurablePlugins({
      manifestPlugins: [
        makeManifestPlugin("sandbox", {
          mode: { label: "Mode" },
          gpu: { label: "GPU", advanced: true },
        }),
      ],
    });
    expect(result.map((plugin) => plugin.id)).toEqual(["sandbox"]);
    expect(Object.keys(result[0]?.uiHints ?? {})).toEqual(["mode"]);
  });
});

describe("discoverUnconfiguredPlugins", () => {
  it("returns plugins with at least one unconfigured field", () => {
    const plugins = [
      makeManifestPlugin("sandbox", {
        mode: { label: "Mode" },
        gateway: { label: "Gateway" },
      }),
    ];
    expect(
      discoverUnconfiguredPlugins({
        manifestPlugins: plugins,
        config: { plugins: { entries: { sandbox: { config: { mode: "mirror" } } } } },
      }).map((plugin) => plugin.id),
    ).toEqual(["sandbox"]);
  });
});

describe("setupPluginConfig", () => {
  it("prompts for unconfigured plugin fields", async () => {
    const prompter = {
      select: vi.fn(async () => "sandbox"),
      text: vi.fn(async () => "main"),
      confirm: vi.fn(),
      note: vi.fn(),
    } as unknown as WizardPrompter;

    const result = await setupPluginConfig({
      config: {},
      prompter,
      manifestPlugins: [
        makeManifestPlugin("sandbox", {
          gateway: { label: "Gateway" },
        }),
      ],
    });

    expect(result.plugins?.entries?.sandbox?.config).toEqual({ gateway: "main" });
  });
});
