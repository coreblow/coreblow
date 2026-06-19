import { describe, expect, it, vi } from "vitest";
import { transcribeOpenAiCompatibleAudio } from "./openai-compatible-audio.js";

describe("OpenAI-compatible audio", () => {
  it("posts multipart audio and returns trimmed text", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ text: "  hello  " }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    await expect(
      transcribeOpenAiCompatibleAudio({
        buffer: Buffer.from("audio"),
        fileName: "clip.wav",
        apiKey: "test-key",
        timeoutMs: 1_000,
        baseUrl: "http://127.0.0.1/v1",
        defaultBaseUrl: "http://127.0.0.1/v1",
        defaultModel: "whisper-1",
        fetchFn,
      }),
    ).resolves.toEqual({ text: "hello", model: "whisper-1" });
  });
});
