import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listVideoGenerationProviders: vi.fn(() => []),
  getVideoGenerationProvider: vi.fn(() => undefined),
}));

vi.mock("../api.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api.js")>();
  return {
    ...actual,
    listVideoGenerationProviders: mocks.listVideoGenerationProviders,
    getVideoGenerationProvider: mocks.getVideoGenerationProvider,
  };
});

import { generateVideo, listRuntimeVideoGenerationProviders } from "./runtime.js";

describe("video-generation core runtime", () => {
  beforeEach(() => {
    mocks.listVideoGenerationProviders.mockClear();
    mocks.listVideoGenerationProviders.mockReturnValue([]);
    mocks.getVideoGenerationProvider.mockClear();
    mocks.getVideoGenerationProvider.mockReturnValue(undefined);
  });

  it("lists providers through the shared runtime surface", () => {
    expect(listRuntimeVideoGenerationProviders({ config: {} })).toEqual([]);
    expect(mocks.listVideoGenerationProviders).toHaveBeenCalledWith({});
  });

  it("rejects generation when no model is configured", async () => {
    await expect(generateVideo({ cfg: {}, prompt: "animate the scene" })).rejects.toThrow(
      "No video-generation model configured",
    );
  });
});
