import { describe, expect, it, vi } from "vitest";
import {
  buildReferenceInputCapabilityFailure,
  mergeVideoGenerationProviderCapabilities,
  resolveProviderWithModelCapabilities,
} from "./capability-overlays.js";
import type { VideoGenerationProvider } from "./types.js";

function makeProvider(overrides: Partial<VideoGenerationProvider> = {}): VideoGenerationProvider {
  return {
    id: "demo",
    capabilities: {
      generate: { providerOptions: { seed: "number" } },
      imageToVideo: { enabled: true, maxInputImages: 1 },
      videoToVideo: { enabled: false, maxInputVideos: 0 },
    },
    generateVideo: async () => ({ videos: [] }),
    ...overrides,
  };
}

describe("video generation capability overlays", () => {
  it("reports reference input capability failures", () => {
    expect(
      buildReferenceInputCapabilityFailure({
        providerId: "demo",
        model: "model",
        provider: makeProvider(),
        inputImageCount: 2,
        inputVideoCount: 0,
        inputAudioCount: 0,
      }),
    ).toContain("supports at most 1 reference image");
  });

  it("merges mode-specific provider options", () => {
    expect(
      mergeVideoGenerationProviderCapabilities(
        { generate: { providerOptions: { seed: "number" } } },
        { generate: { providerOptions: { enhance: "boolean" } } },
      ).generate?.providerOptions,
    ).toEqual({ seed: "number", enhance: "boolean" });
  });

  it("applies dynamic model capabilities when available", async () => {
    const resolveModelCapabilities = vi.fn(async () => ({
      imageToVideo: { enabled: true, maxInputImages: 3 },
    }));
    const provider = await resolveProviderWithModelCapabilities({
      provider: makeProvider({ resolveModelCapabilities }),
      providerId: "demo",
      model: "model",
      cfg: {},
      log: console,
    });

    expect(provider.capabilities.imageToVideo?.maxInputImages).toBe(3);
    expect(resolveModelCapabilities).toHaveBeenCalledOnce();
  });
});
