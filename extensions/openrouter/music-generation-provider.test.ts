import { describe, expect, it } from "vitest";
import {
  buildOpenRouterMusicGenerationProvider,
  buildOpenRouterMusicPrompt,
} from "./music-generation-provider.js";

describe("openrouter music generation provider contract", () => {
  it("keeps OpenRouter music metadata available without fake SDK registration", () => {
    const provider = buildOpenRouterMusicGenerationProvider();

    expect(provider.id).toBe("openrouter");
    expect(provider.defaultModel).toBe("google/lyria-3-pro-preview");
    expect(provider.models).toContain("google/lyria-3-clip-preview");
  });

  it("builds the OpenRouter music prompt from structured fields", () => {
    expect(
      buildOpenRouterMusicPrompt({
        prompt: "cinematic synthwave",
        lyrics: "lights on the bay",
        instrumental: false,
        durationSeconds: 45,
      }),
    ).toContain("Lyrics:\nlights on the bay");
  });
});
