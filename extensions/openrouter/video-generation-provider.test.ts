import { describe, expect, it } from "vitest";
import { buildOpenRouterVideoGenerationProvider, buildOpenRouterVideoRequestBody } from "./video-generation-provider.js";
import { parseOpenRouterVideoPollResult } from "./video-http.js";
import { listOpenRouterVideoModelCatalog } from "./video-model-catalog.js";

describe("openrouter video generation provider", () => {
  it("advertises OpenRouter video generation capabilities", () => {
    const provider = buildOpenRouterVideoGenerationProvider();

    expect(provider.id).toBe("openrouter");
    expect(provider.defaultModel).toBe("google/veo-3.1-fast");
    expect(provider.models).toContain("google/veo-3.1");
    expect(provider.capabilities.generate?.supportsAudio).toBe(true);
    expect(provider.capabilities.imageToVideo?.enabled).toBe(true);
  });

  it("builds OpenRouter video request payloads", () => {
    const body = buildOpenRouterVideoRequestBody({
      provider: "openrouter",
      model: "google/veo-3.1",
      prompt: "a product spin",
      cfg: {},
      aspectRatio: "16:9",
      resolution: "1080P",
      audio: true,
    });

    expect(body).toMatchObject({
      model: "google/veo-3.1",
      prompt: "a product spin",
      aspect_ratio: "16:9",
      resolution: "1080P",
      generate_audio: true,
    });
  });

  it("parses OpenRouter polling payloads", () => {
    const result = parseOpenRouterVideoPollResult({
      id: "gen_123",
      polling_url: "https://openrouter.ai/api/v1/generation/gen_123",
      status: "completed",
      output: {
        unsigned_urls: ["https://cdn.example/video.mp4"],
      },
    });

    expect(result).toEqual({
      id: "gen_123",
      pollingUrl: "https://openrouter.ai/api/v1/generation/gen_123",
      status: "completed",
      videos: ["https://cdn.example/video.mp4"],
    });
  });

  it("exposes a local video model catalog", () => {
    expect(listOpenRouterVideoModelCatalog().map((entry) => entry.id)).toEqual([
      "google/veo-3.1-fast",
      "google/veo-3.1",
    ]);
  });
});
