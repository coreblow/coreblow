import { afterEach, describe, expect, it, vi } from "vitest";
import { buildGradiumSpeechProvider } from "./speech-provider.js";

describe("gradium speech provider", () => {
  const provider = buildGradiumSpeechProvider();

  const firstFetchCall = (fetchMock: ReturnType<typeof vi.fn>): [string, RequestInit] => {
    const call = fetchMock.mock.calls[0] as [string, RequestInit] | undefined;
    if (!call) {
      throw new Error("expected Gradium fetch call");
    }
    return call;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports configured when GRADIUM_API_KEY is set", () => {
    const original = process.env.GRADIUM_API_KEY;
    try {
      process.env.GRADIUM_API_KEY = "gsk_test";
      expect(provider.isConfigured({ providerConfig: {}, timeoutMs: 5_000 } as never)).toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.GRADIUM_API_KEY;
      } else {
        process.env.GRADIUM_API_KEY = original;
      }
    }
  });

  it("synthesizes audio via the Gradium TTS endpoint", async () => {
    const audioData = Buffer.from("wav-audio-data");
    const fetchMock = vi.fn().mockResolvedValue(new Response(audioData, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await provider.synthesize({
      text: "CoreBlow test",
      cfg: {} as never,
      providerConfig: { apiKey: "gsk_test123" },
      target: "audio-file",
      timeoutMs: 30_000,
    } as never);

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = firstFetchCall(fetchMock);
    expect(url).toBe("https://api.gradium.ai/api/post/speech/tts");
    expect(new Headers(init.headers).get("x-api-key")).toBe("gsk_test123");
    expect(JSON.parse(init.body as string)).toEqual({
      text: "CoreBlow test",
      voice_id: "YTpq7expH9539ERJ",
      only_audio: true,
      output_format: "wav",
      json_config: '{"padding_bonus":0}',
    });
    expect(result.outputFormat).toBe("wav");
    expect(result.fileExtension).toBe(".wav");
    expect(result.voiceCompatible).toBe(false);
    expect(result.audioBuffer).toEqual(audioData);
  });
});
