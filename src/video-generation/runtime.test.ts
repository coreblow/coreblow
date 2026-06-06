import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { createEmptyPluginRegistry } from "../plugins/registry.js";

const { resolveRuntimePluginRegistryMock } = vi.hoisted(() => ({
  resolveRuntimePluginRegistryMock: vi.fn<(...args: unknown[]) => unknown>(() => undefined),
}));

vi.mock("../plugins/loader.js", () => ({
  resolveRuntimePluginRegistry: resolveRuntimePluginRegistryMock,
}));

let generateVideo: typeof import("./runtime.js").generateVideo;
let listRuntimeVideoGenerationProviders: typeof import("./runtime.js").listRuntimeVideoGenerationProviders;

describe("video-generation runtime", () => {
  afterEach(() => {
    resolveRuntimePluginRegistryMock.mockReset();
    resolveRuntimePluginRegistryMock.mockReturnValue(undefined);
  });

  beforeEach(async () => {
    vi.resetModules();
    ({ generateVideo, listRuntimeVideoGenerationProviders } = await import("./runtime.js"));
  });

  it("generates videos through the active video-generation registry", async () => {
    const registry = createEmptyPluginRegistry();
    const authStore = { version: 1, profiles: {} } as const;
    let seenAuthStore: unknown;
    registry.videoGenerationProviders.push({
      pluginId: "video-plugin",
      pluginName: "Video Plugin",
      source: "test",
      provider: {
        id: "video-plugin",
        capabilities: {},
        async generateVideo(req) {
          seenAuthStore = req.authStore;
          return {
            videos: [
              {
                buffer: Buffer.from("mp4-bytes"),
                mimeType: "video/mp4",
                fileName: "sample.mp4",
              },
            ],
            model: "vid-v1",
          };
        },
      },
    });
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    const result = await generateVideo({
      cfg: {
        agents: {
          defaults: {
            videoGenerationModel: { primary: "video-plugin/vid-v1" },
          },
        },
      } as unknown as CoreBlowConfig,
      prompt: "animate a cat",
      agentDir: "/tmp/agent",
      authStore,
    });

    expect(result.provider).toBe("video-plugin");
    expect(result.model).toBe("vid-v1");
    expect(result.attempts).toEqual([]);
    expect(seenAuthStore).toEqual(authStore);
    expect(result.videos).toEqual([
      {
        buffer: Buffer.from("mp4-bytes"),
        mimeType: "video/mp4",
        fileName: "sample.mp4",
      },
    ]);
  });

  it("falls through configured video-generation model fallbacks", async () => {
    const registry = createEmptyPluginRegistry();
    registry.videoGenerationProviders.push(
      {
        pluginId: "openai",
        pluginName: "OpenAI",
        source: "test",
        provider: {
          id: "openai",
          capabilities: {},
          async generateVideo() {
            throw new Error("Your request was blocked by our moderation system.");
          },
        },
      },
      {
        pluginId: "runway",
        pluginName: "Runway",
        source: "test",
        provider: {
          id: "runway",
          capabilities: {},
          async generateVideo() {
            return {
              videos: [{ buffer: Buffer.from("mp4-bytes"), mimeType: "video/mp4" }],
              model: "gen4.5",
            };
          },
        },
      },
    );
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    const result = await generateVideo({
      cfg: {
        agents: {
          defaults: {
            videoGenerationModel: {
              primary: "openai/sora-2",
              fallbacks: ["runway/gen4.5"],
            },
          },
        },
      } as unknown as CoreBlowConfig,
      prompt: "animate a cat",
    });

    expect(result.provider).toBe("runway");
    expect(result.model).toBe("gen4.5");
    expect(result.attempts).toEqual([
      {
        provider: "openai",
        model: "sora-2",
        error: "Your request was blocked by our moderation system.",
      },
    ]);
  });

  it("lists runtime video-generation providers from the active registry", () => {
    const registry = createEmptyPluginRegistry();
    registry.videoGenerationProviders.push({
      pluginId: "video-plugin",
      pluginName: "Video Plugin",
      source: "test",
      provider: {
        id: "video-plugin",
        defaultModel: "vid-v1",
        models: ["vid-v1", "vid-v2"],
        capabilities: {
          generate: {
            supportsResolution: true,
            resolutions: ["720P"],
          },
          imageToVideo: {
            enabled: true,
            maxInputImages: 2,
          },
        },
        generateVideo: async () => ({
          videos: [{ buffer: Buffer.from("video"), mimeType: "video/mp4" }],
        }),
      },
    });
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    expect(listRuntimeVideoGenerationProviders()).toMatchObject([
      {
        id: "video-plugin",
        defaultModel: "vid-v1",
        models: ["vid-v1", "vid-v2"],
        capabilities: {
          generate: {
            supportsResolution: true,
            resolutions: ["720P"],
          },
          imageToVideo: {
            enabled: true,
            maxInputImages: 2,
          },
        },
      },
    ]);
  });

  it("explains native video-generation config when no model is configured", async () => {
    const registry = createEmptyPluginRegistry();
    registry.videoGenerationProviders.push({
      pluginId: "google",
      pluginName: "Google",
      source: "test",
      provider: {
        id: "google",
        defaultModel: "veo-3.1-fast-generate-preview",
        capabilities: {},
        generateVideo: async () => ({
          videos: [{ buffer: Buffer.from("video"), mimeType: "video/mp4" }],
        }),
      },
    });
    resolveRuntimePluginRegistryMock.mockReturnValue(registry);

    await expect(generateVideo({ cfg: {} as CoreBlowConfig, prompt: "animate a cat" })).rejects.toThrow(
      "No video-generation model configured.",
    );
  });
});
