import { describe, expect, it } from "vitest";
import { buildFalVideoGenerationProvider, buildFalVideoRequestBody } from "./video-generation-provider.js";

describe("fal video generation provider", () => {
  it("advertises fal video capabilities", () => {
    const provider = buildFalVideoGenerationProvider();

    expect(provider.id).toBe("fal");
    expect(provider.defaultModel).toBe("fal-ai/minimax/video-01-live");
    expect(provider.models).toContain("bytedance/seedance-2.0/fast/image-to-video");
    expect(provider.capabilities.imageToVideo?.enabled).toBe(true);
    expect(provider.capabilities.videoToVideo?.enabled).toBe(false);
  });

  it("builds text-to-video request bodies", () => {
    expect(
      buildFalVideoRequestBody({
        provider: "fal",
        model: "fal-ai/minimax/video-01-live",
        prompt: "A spaceship emerges from the clouds",
        durationSeconds: 5,
        aspectRatio: "16:9",
        resolution: "720P",
        cfg: {},
      }),
    ).toEqual({
      prompt: "A spaceship emerges from the clouds",
      duration: 5,
      aspect_ratio: "16:9",
      resolution: "720P",
    });
  });

  it("maps image inputs to image_url", () => {
    expect(
      buildFalVideoRequestBody({
        provider: "fal",
        model: "bytedance/seedance-2.0/fast/image-to-video",
        prompt: "animate",
        cfg: {},
        inputImages: [
          {
            buffer: Buffer.from("png"),
            mimeType: "image/png",
          },
        ],
      }),
    ).toMatchObject({
      image_url: `data:image/png;base64,${Buffer.from("png").toString("base64")}`,
    });
  });
});
