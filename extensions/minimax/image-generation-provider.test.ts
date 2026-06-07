import { describe, expect, it } from "vitest";
import {
  buildMinimaxImageGenerationProvider,
  buildMinimaxPortalImageGenerationProvider,
} from "./image-generation-provider.js";

describe("MiniMax image generation providers", () => {
  it("registers API and portal providers with expected metadata", () => {
    expect(buildMinimaxImageGenerationProvider()).toMatchObject({ id: "minimax" });
    expect(buildMinimaxPortalImageGenerationProvider()).toMatchObject({ id: "minimax-portal" });
  });
});
