import { describe, expect, it } from "vitest";
import { buildQwenVideoGenerationProvider } from "./video-generation-provider.js";

describe("qwen video generation provider", () => {
  it("advertises Qwen Cloud video generation capabilities", () => {
    const provider = buildQwenVideoGenerationProvider();

    expect(provider.id).toBe("qwen");
    expect(provider.label).toBe("Qwen Cloud");
    expect(provider.defaultModel).toBe("wan2.6-t2v");
    expect(provider.models).toContain("wan2.6-t2v");
    expect(provider.capabilities.generate?.supportsWatermark).toBe(true);
    expect(provider.capabilities.imageToVideo?.enabled).toBe(true);
    expect(provider.capabilities.videoToVideo?.enabled).toBe(false);
  });
});
