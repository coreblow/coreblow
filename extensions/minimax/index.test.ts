import { describe, expect, it, vi } from "vitest";
import plugin from "./index.js";

describe("minimax plugin", () => {
  it("registers provider and generated media capability providers", () => {
    const api = {
      registerProvider: vi.fn(),
      registerMediaUnderstandingProvider: vi.fn(),
      registerImageGenerationProvider: vi.fn(),
      registerSpeechProvider: vi.fn(),
      registerMusicGenerationProvider: vi.fn(),
      registerVideoGenerationProvider: vi.fn(),
      registerWebSearchProvider: vi.fn(),
    };

    plugin.register(api as never);

    expect(api.registerProvider).toHaveBeenCalledTimes(2);
    expect(api.registerMediaUnderstandingProvider).toHaveBeenCalledTimes(2);
    expect(api.registerImageGenerationProvider).toHaveBeenCalledTimes(2);
    expect(api.registerSpeechProvider).toHaveBeenCalledTimes(1);
    expect(api.registerMusicGenerationProvider).toHaveBeenCalledTimes(2);
    expect(api.registerVideoGenerationProvider).toHaveBeenCalledTimes(2);
    expect(api.registerWebSearchProvider).toHaveBeenCalledTimes(1);
  });
});
