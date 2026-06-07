import { describe, expect, it } from "vitest";
import {
  buildMinimaxPortalVideoGenerationProvider,
  buildMinimaxVideoGenerationProvider,
} from "./video-generation-provider.js";

describe("MiniMax video generation providers", () => {
  it("registers API and portal providers with expected metadata", () => {
    expect(buildMinimaxVideoGenerationProvider()).toMatchObject({
      id: "minimax",
      defaultModel: "MiniMax-Hailuo-2.3",
    });
    expect(buildMinimaxPortalVideoGenerationProvider()).toMatchObject({
      id: "minimax-portal",
      defaultModel: "MiniMax-Hailuo-2.3",
    });
  });
});
