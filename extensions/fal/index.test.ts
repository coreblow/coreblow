import { describe, expect, it } from "vitest";
import { createCapturedPluginRegistration } from "../../src/plugins/captured-registration.js";
import plugin from "./index.js";

describe("fal plugin", () => {
  it("registers provider and media generation surfaces", () => {
    const captured = createCapturedPluginRegistration();
    plugin.register(captured.api);

    expect(captured.providers.map((provider) => provider.id)).toEqual(["fal"]);
    expect(captured.providers[0]?.auth[0]?.hint).toBe(
      "Image, video, and music generation API key",
    );
    expect(captured.imageGenerationProviders.map((provider) => provider.id)).toEqual(["fal"]);
    expect(captured.videoGenerationProviders.map((provider) => provider.id)).toEqual(["fal"]);
    expect(captured.musicGenerationProviders.map((provider) => provider.id)).toEqual(["fal"]);
  });
});
