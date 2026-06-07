import { describe, expect, it } from "vitest";
import {
  DEFAULT_ELEVENLABS_REALTIME_MODEL,
  buildElevenLabsRealtimeTranscriptionProvider,
} from "./realtime-transcription-provider.js";

describe("buildElevenLabsRealtimeTranscriptionProvider", () => {
  it("normalizes realtime provider config", () => {
    const provider = buildElevenLabsRealtimeTranscriptionProvider();
    const config = provider.resolveConfig?.({
      cfg: {} as never,
      rawConfig: {
        elevenlabs: {
          baseUrl: "https://api.example.test/",
        },
      },
    });

    expect(config).toMatchObject({
      baseUrl: "https://api.example.test",
      modelId: DEFAULT_ELEVENLABS_REALTIME_MODEL,
      commitStrategy: "vad",
    });
  });

  it("reports configured when an API key is provided", () => {
    const provider = buildElevenLabsRealtimeTranscriptionProvider();

    expect(
      provider.isConfigured?.({
        providerConfig: { apiKey: "test-key" },
      }),
    ).toBe(true);
  });

  it("rejects unsupported commit strategies", () => {
    const provider = buildElevenLabsRealtimeTranscriptionProvider();

    expect(() =>
      provider.resolveConfig?.({
        cfg: {} as never,
        rawConfig: { commitStrategy: "always" },
      }),
    ).toThrow(/Unsupported ElevenLabs realtime commit strategy/);
  });
});
