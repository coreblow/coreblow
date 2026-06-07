import { describe, expect, it } from "vitest";
import {
  buildMinimaxMusicGenerationProvider,
  buildMinimaxPortalMusicGenerationProvider,
} from "./music-generation-provider.js";

describe("MiniMax music generation providers", () => {
  it("registers API and portal providers with expected metadata", () => {
    expect(buildMinimaxMusicGenerationProvider()).toMatchObject({
      id: "minimax",
      defaultModel: "music-2.6",
    });
    expect(buildMinimaxPortalMusicGenerationProvider()).toMatchObject({
      id: "minimax-portal",
      defaultModel: "music-2.6",
    });
  });
});
