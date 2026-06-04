import { describe, expect, it } from "vitest";
import { generateVideo, listRuntimeVideoGenerationProviders } from "./runtime.js";

describe("video-generation core runtime", () => {
  it("lists providers through the shared runtime surface", () => {
    expect(listRuntimeVideoGenerationProviders({ config: {} })).toEqual([]);
  });

  it("rejects generation when no model is configured", async () => {
    await expect(generateVideo({ cfg: {}, prompt: "animate the scene" })).rejects.toThrow(
      "No video-generation model configured",
    );
  });
});
