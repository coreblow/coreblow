import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyPluginRegistry } from "../plugins/registry.js";
import type { VideoGenerationProvider } from "./types.js";

const { resolveRuntimePluginRegistryMock } = vi.hoisted(() => ({
  resolveRuntimePluginRegistryMock: vi.fn<(...args: unknown[]) => unknown>(() => undefined),
}));

vi.mock("../plugins/loader.js", () => ({
  resolveRuntimePluginRegistry: resolveRuntimePluginRegistryMock,
}));

let getVideoGenerationProvider: typeof import("./provider-registry.js").getVideoGenerationProvider;
let listVideoGenerationProviders: typeof import("./provider-registry.js").listVideoGenerationProviders;

function createProvider(params: Pick<VideoGenerationProvider, "id"> & Partial<VideoGenerationProvider>) {
  return {
    capabilities: {},
    generateVideo: async () => ({
      videos: [{ buffer: Buffer.from("video"), mimeType: "video/mp4" }],
    }),
    ...params,
  } satisfies VideoGenerationProvider;
}

describe("video-generation provider registry", () => {
  afterEach(() => {
    resolveRuntimePluginRegistryMock.mockReset();
    resolveRuntimePluginRegistryMock.mockReturnValue(undefined);
  });

  beforeEach(async () => {
    vi.resetModules();
    ({ getVideoGenerationProvider, listVideoGenerationProviders } =
      await import("./provider-registry.js"));
  });

  it("does not load providers when listing without config", () => {
    expect(listVideoGenerationProviders()).toEqual([]);
    expect(resolveRuntimePluginRegistryMock).toHaveBeenCalledWith();
  });

  it("uses active plugin providers without loading from disk", () => {
    const registry = createEmptyPluginRegistry();
    registry.videoGenerationProviders.push({
      pluginId: "custom-video",
      pluginName: "Custom Video",
      source: "test",
      provider: createProvider({ id: "custom-video" }),
    });
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    const provider = getVideoGenerationProvider("custom-video");

    expect(provider?.id).toBe("custom-video");
    expect(resolveRuntimePluginRegistryMock).toHaveBeenCalledWith();
  });

  it("ignores prototype-like provider ids and aliases", () => {
    const registry = createEmptyPluginRegistry();
    registry.videoGenerationProviders.push(
      {
        pluginId: "blocked-video",
        pluginName: "Blocked Video",
        source: "test",
        provider: createProvider({ id: "__proto__", aliases: ["constructor", "prototype"] }),
      },
      {
        pluginId: "safe-video",
        pluginName: "Safe Video",
        source: "test",
        provider: createProvider({ id: "safe-video", aliases: ["safe-alias", "constructor"] }),
      },
    );
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    expect(listVideoGenerationProviders().map((provider) => provider.id)).toEqual(["safe-video"]);
    expect(getVideoGenerationProvider("__proto__")).toBeUndefined();
    expect(getVideoGenerationProvider("constructor")).toBeUndefined();
    expect(getVideoGenerationProvider("safe-alias")?.id).toBe("safe-video");
  });
});
