import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildDeepgramRealtimeTranscriptionProvider,
  testing,
} from "./realtime-transcription-provider.js";

describe("buildDeepgramRealtimeTranscriptionProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes nested provider config", () => {
    const provider = buildDeepgramRealtimeTranscriptionProvider();
    const resolved = provider.resolveConfig({
      rawConfig: {
        providers: {
          deepgram: {
            apiKey: "dg-key",
            model: "nova-3",
            encoding: "g711_ulaw",
            sample_rate: "8000",
            interim_results: "true",
            endpointing: "500",
            language: "en-US",
          },
        },
      },
    });

    expect(resolved).toEqual({
      apiKey: "dg-key",
      baseUrl: undefined,
      model: "nova-3",
      language: "en-US",
      sampleRate: 8000,
      encoding: "mulaw",
      interimResults: true,
      endpointingMs: 500,
    });
  });

  it("builds a Deepgram listen websocket URL", () => {
    const url = testing.toDeepgramRealtimeWsUrl({
      baseUrl: "https://api.deepgram.com/v1",
      model: "nova-3",
      sampleRate: 8000,
      encoding: "mulaw",
      interimResults: true,
      endpointingMs: 800,
    });

    expect(url).toContain("wss://api.deepgram.com/v1/listen?");
    expect(url).toContain("model=nova-3");
    expect(url).toContain("encoding=mulaw");
    expect(url).toContain("sample_rate=8000");
  });

  it("requires an API key when creating sessions", () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "");
    const provider = buildDeepgramRealtimeTranscriptionProvider();
    expect(() => provider.createSession({ providerConfig: {} })).toThrow(
      "Deepgram API key missing",
    );
  });
});
