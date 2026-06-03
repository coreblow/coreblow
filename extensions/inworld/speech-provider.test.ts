import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const { inworldTTSMock, listInworldVoicesMock } = vi.hoisted(() => ({
  inworldTTSMock: vi.fn(),
  listInworldVoicesMock: vi.fn(),
}));

vi.mock("./tts.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./tts.js")>();
  return {
    ...actual,
    inworldTTS: inworldTTSMock,
    listInworldVoices: listInworldVoicesMock,
  };
});

import { buildInworldSpeechProvider } from "./speech-provider.js";

afterAll(() => {
  vi.doUnmock("./tts.js");
  vi.resetModules();
});

describe("buildInworldSpeechProvider", () => {
  afterEach(() => {
    inworldTTSMock.mockReset();
    listInworldVoicesMock.mockReset();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("reports configured when INWORLD_API_KEY env var is set", () => {
    vi.stubEnv("INWORLD_API_KEY", "test-key");
    const provider = buildInworldSpeechProvider();
    expect(provider.isConfigured({ providerConfig: {}, timeoutMs: 30_000 } as never)).toBe(true);
  });

  it("normalizes provider-owned speech config from raw provider config", () => {
    const provider = buildInworldSpeechProvider();
    const resolved = provider.resolveConfig?.({
      cfg: {} as never,
      timeoutMs: 30_000,
      rawConfig: {
        providers: {
          inworld: {
            apiKey: "basic-key",
            baseUrl: "https://custom.inworld.example.com/",
            voiceId: "Ashley",
            modelId: "inworld-tts-1.5-mini",
            temperature: 0.8,
          },
        },
      },
    });

    expect(resolved).toEqual({
      apiKey: "basic-key",
      baseUrl: "https://custom.inworld.example.com",
      voiceId: "Ashley",
      modelId: "inworld-tts-1.5-mini",
      temperature: 0.8,
    });
  });

  it("synthesizes voice-note targets with native OGG_OPUS output", async () => {
    inworldTTSMock.mockResolvedValueOnce(Buffer.from("opus"));
    const provider = buildInworldSpeechProvider();
    const result = await provider.synthesize?.({
      text: "Hello",
      cfg: {} as never,
      providerConfig: { apiKey: "key", voiceId: "Sarah", modelId: "inworld-tts-1.5-max" },
      providerOverrides: { voice: "Ashley", model: "inworld-tts-1.5-mini", temperature: 0.6 },
      target: "voice-note",
      timeoutMs: 30_000,
    } as never);

    expect(inworldTTSMock).toHaveBeenCalledWith({
      text: "Hello",
      apiKey: "key",
      baseUrl: "https://api.inworld.ai",
      voiceId: "Ashley",
      modelId: "inworld-tts-1.5-mini",
      audioEncoding: "OGG_OPUS",
      temperature: 0.6,
      timeoutMs: 30_000,
    });
    expect(result).toEqual({
      audioBuffer: Buffer.from("opus"),
      outputFormat: "ogg_opus",
      fileExtension: ".ogg",
      voiceCompatible: true,
    });
  });
});
