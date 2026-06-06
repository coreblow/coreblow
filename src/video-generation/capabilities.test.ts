import { describe, expect, it } from "vitest";
import {
  listSupportedVideoGenerationModes,
  resolveVideoGenerationMode,
  resolveVideoGenerationModeCapabilities,
} from "./capabilities.js";
import type { VideoGenerationProvider } from "./types.js";

function makeProvider(): VideoGenerationProvider {
  return {
    id: "demo",
    capabilities: {
      generate: { maxVideos: 1 },
      imageToVideo: {
        enabled: true,
        maxInputImages: 2,
        maxInputImagesByModel: { "demo/single": 1 },
      },
      videoToVideo: {
        enabled: true,
        maxInputVideos: 1,
        maxInputAudiosByModel: { "demo/audio": 2 },
      },
    },
    generateVideo: async () => ({ videos: [] }),
  };
}

describe("video generation capabilities", () => {
  it("resolves generation mode from reference inputs", () => {
    expect(resolveVideoGenerationMode({})).toBe("generate");
    expect(resolveVideoGenerationMode({ inputImageCount: 1 })).toBe("imageToVideo");
    expect(resolveVideoGenerationMode({ inputVideoCount: 1 })).toBe("videoToVideo");
    expect(resolveVideoGenerationMode({ inputImageCount: 1, inputVideoCount: 1 })).toBeNull();
  });

  it("lists supported provider modes", () => {
    expect(listSupportedVideoGenerationModes(makeProvider())).toEqual([
      "generate",
      "imageToVideo",
      "videoToVideo",
    ]);
  });

  it("applies model-specific input limits", () => {
    const { capabilities } = resolveVideoGenerationModeCapabilities({
      provider: makeProvider(),
      model: "demo/single",
      inputImageCount: 1,
    });

    expect(capabilities).toMatchObject({ maxInputImages: 1 });
  });
});
