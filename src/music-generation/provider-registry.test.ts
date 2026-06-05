// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPluginRegistry } from "../plugins/registry.js";

const { resolveRuntimePluginRegistryMock } = vi.hoisted(() => ({
  resolveRuntimePluginRegistryMock: vi.fn(() => undefined),
}));

vi.mock("../plugins/loader.js", () => ({
  resolveRuntimePluginRegistry: resolveRuntimePluginRegistryMock,
}));

let getMusicGenerationProvider: typeof import("./provider-registry.js").getMusicGenerationProvider;
let listMusicGenerationProviders: typeof import("./provider-registry.js").listMusicGenerationProviders;

describe("music-generation provider registry", () => {
  afterEach(() => {
    resolveRuntimePluginRegistryMock.mockReset();
    resolveRuntimePluginRegistryMock.mockReturnValue(undefined);
  });

  beforeEach(async () => {
    vi.resetModules();
    ({ getMusicGenerationProvider, listMusicGenerationProviders } =
      await import("./provider-registry.js"));
  });

  it("uses active plugin providers without loading from disk", () => {
    const registry = createEmptyPluginRegistry();
    registry.musicGenerationProviders?.push({
      pluginId: "custom-music",
      pluginName: "Custom Music",
      source: "test",
      provider: {
        id: "custom-music",
        label: "Custom Music",
        capabilities: {},
        generateMusic: async () => ({
          tracks: [{ buffer: Buffer.from("music"), mimeType: "audio/mpeg" }],
        }),
      },
    });
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    const provider = getMusicGenerationProvider("custom-music");

    expect(provider?.id).toBe("custom-music");
    expect(resolveRuntimePluginRegistryMock).toHaveBeenCalledWith();
  });

  it("ignores prototype-like provider ids and aliases", () => {
    const registry = createEmptyPluginRegistry();
    registry.musicGenerationProviders?.push(
      {
        pluginId: "blocked-music",
        pluginName: "Blocked Music",
        source: "test",
        provider: {
          id: "__proto__",
          aliases: ["constructor", "prototype"],
          capabilities: {},
          generateMusic: async () => ({
            tracks: [{ buffer: Buffer.from("music"), mimeType: "audio/mpeg" }],
          }),
        },
      },
      {
        pluginId: "safe-music",
        pluginName: "Safe Music",
        source: "test",
        provider: {
          id: "safe-music",
          aliases: ["safe-alias", "constructor"],
          capabilities: {},
          generateMusic: async () => ({
            tracks: [{ buffer: Buffer.from("music"), mimeType: "audio/mpeg" }],
          }),
        },
      },
    );
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    expect(listMusicGenerationProviders().map((provider) => provider.id)).toEqual(["safe-music"]);
    expect(getMusicGenerationProvider("__proto__")).toBeUndefined();
    expect(getMusicGenerationProvider("constructor")).toBeUndefined();
    expect(getMusicGenerationProvider("safe-alias")?.id).toBe("safe-music");
  });
});
