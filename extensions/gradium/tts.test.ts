import { afterEach, describe, expect, it, vi } from "vitest";
import { gradiumTTS } from "./tts.js";

describe("gradium tts diagnostics", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to raw body text when the error body is non-JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("service unavailable", { status: 503 })),
    );

    await expect(
      gradiumTTS({
        text: "hello",
        apiKey: "test-key",
        baseUrl: "https://api.gradium.ai",
        voiceId: "YTpq7expH9539ERJ",
        outputFormat: "wav",
        timeoutMs: 5_000,
      }),
    ).rejects.toThrow("Gradium API error");
  });

  it("sends the correct request payload", async () => {
    const audioData = Buffer.from("fake-wav-data");
    const fetchMock = vi.fn().mockResolvedValue(new Response(audioData, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await gradiumTTS({
      text: "Hello world",
      apiKey: "gsk_test123",
      baseUrl: "https://api.gradium.ai",
      voiceId: "YTpq7expH9539ERJ",
      outputFormat: "wav",
      timeoutMs: 5_000,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.gradium.ai/api/post/speech/tts");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("x-api-key")).toBe("gsk_test123");
    expect(JSON.parse(init.body as string)).toEqual({
      text: "Hello world",
      voice_id: "YTpq7expH9539ERJ",
      only_audio: true,
      output_format: "wav",
      json_config: '{"padding_bonus":0}',
    });
    expect(result).toEqual(audioData);
  });
});
