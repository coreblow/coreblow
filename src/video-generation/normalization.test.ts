import { describe, expect, it } from "vitest";
import { resolveVideoGenerationOverrides } from "./normalization.js";
import type { VideoGenerationProvider } from "./types.js";

const provider: VideoGenerationProvider = {
  id: "demo",
  capabilities: {
    generate: {
      supportsSize: true,
      sizes: ["1024x576"],
      supportsAspectRatio: false,
      supportsResolution: true,
      resolutions: ["480P", "720P"],
      supportsAudio: false,
      supportsWatermark: true,
      supportedDurationSeconds: [5, 10],
    },
  },
  generateVideo: async () => ({ videos: [] }),
};

describe("video generation normalization", () => {
  it("normalizes supported overrides and records ignored values", () => {
    const resolved = resolveVideoGenerationOverrides({
      provider,
      model: "demo/model",
      size: "1024x1024",
      aspectRatio: "1:1",
      resolution: "1080P",
      durationSeconds: 8,
      audio: true,
      watermark: false,
    });

    expect(resolved.size).toBe("1024x576");
    expect(resolved.resolution).toBe("720P");
    expect(resolved.durationSeconds).toBe(10);
    expect(resolved.watermark).toBe(false);
    expect(resolved.ignoredOverrides).toContainEqual({ key: "audio", value: true });
    expect(resolved.normalization).toMatchObject({
      size: { requested: "1024x1024", applied: "1024x576" },
      resolution: { requested: "1080P", applied: "720P" },
      durationSeconds: { requested: 8, applied: 10, supportedValues: [5, 10] },
    });
  });
});
