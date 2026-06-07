import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_ELEVENLABS_AUDIO_MODEL,
  elevenLabsMediaUnderstandingProvider,
  transcribeElevenLabsAudio,
} from "./media-understanding-provider.js";

describe("transcribeElevenLabsAudio", () => {
  it("posts audio to the ElevenLabs speech-to-text endpoint", async () => {
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe("POST");
      expect(init.body).toBeInstanceOf(FormData);
      return new Response(JSON.stringify({ text: "hello coreblow" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;

    const result = await transcribeElevenLabsAudio({
      buffer: Buffer.from("audio"),
      fileName: "sample.wav",
      mime: "audio/wav",
      apiKey: "test-key",
      baseUrl: "http://127.0.0.1:1234/",
      model: undefined,
      timeoutMs: 1000,
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      "http://127.0.0.1:1234/v1/speech-to-text",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(result).toEqual({ text: "hello coreblow", model: DEFAULT_ELEVENLABS_AUDIO_MODEL });
  });

  it("registers audio media understanding capability", () => {
    expect(elevenLabsMediaUnderstandingProvider.capabilities).toContain("audio");
    expect(elevenLabsMediaUnderstandingProvider.transcribeAudio).toBe(transcribeElevenLabsAudio);
  });
});
