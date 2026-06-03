import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runFfmpegMock = vi.hoisted(() => vi.fn());

vi.mock("coreblow/plugin-sdk/media-runtime", () => ({
  runFfmpeg: runFfmpegMock,
}));

import { buildXiaomiSpeechProvider } from "./speech-provider.js";

describe("buildXiaomiSpeechProvider", () => {
  const provider = buildXiaomiSpeechProvider();
  const savedFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    runFfmpegMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    globalThis.fetch = savedFetch;
    vi.restoreAllMocks();
  });

  it("registers Xiaomi MiMo as a speech provider", () => {
    expect(provider.id).toBe("xiaomi");
    expect(provider.aliases).toContain("mimo");
    expect(provider.models).toContain("mimo-v2.5-tts");
    expect(provider.voices).toContain("mimo_default");
  });

  it("resolves Xiaomi speech config from providers.xiaomi", () => {
    const config = provider.resolveConfig!({
      rawConfig: {
        providers: {
          xiaomi: {
            baseUrl: "https://example.com/v1/",
            model: "mimo-v2-tts",
            voice: "default_en",
            format: "wav",
            style: "Bright and fast.",
          },
        },
      },
      cfg: {} as never,
      timeoutMs: 30000,
    });

    expect(config).toEqual({
      apiKey: undefined,
      baseUrl: "https://example.com/v1",
      model: "mimo-v2-tts",
      voice: "default_en",
      format: "wav",
      style: "Bright and fast.",
    });
  });

  it("parses voice/model/style/format directive tokens", () => {
    const policy = {
      enabled: true,
      allowText: true,
      allowProvider: true,
      allowVoice: true,
      allowModelId: true,
      allowVoiceSettings: true,
      allowNormalization: true,
      allowSeed: true,
    };

    expect(provider.parseDirectiveToken!({ key: "voice", value: "default_en", policy })).toEqual({
      handled: true,
      overrides: { voice: "default_en" },
    });
    expect(provider.parseDirectiveToken!({ key: "model", value: "mimo-v2-tts", policy })).toEqual(
      { handled: true, overrides: { model: "mimo-v2-tts" } },
    );
    expect(provider.parseDirectiveToken!({ key: "style", value: "whispered", policy })).toEqual({
      handled: true,
      overrides: { style: "whispered" },
    });
    expect(provider.parseDirectiveToken!({ key: "format", value: "wav", policy })).toEqual({
      handled: true,
      overrides: { format: "wav" },
    });
  });

  it("warns on invalid format", () => {
    const policy = {
      enabled: true,
      allowText: true,
      allowProvider: true,
      allowVoice: true,
      allowModelId: true,
      allowVoiceSettings: true,
      allowNormalization: true,
      allowSeed: true,
    };
    const result = provider.parseDirectiveToken!({ key: "format", value: "ogg", policy });
    expect(result.handled).toBe(true);
    expect(result.warnings).toHaveLength(1);
  });

  it("makes the Xiaomi chat completions TTS call and decodes audio", async () => {
    const audio = Buffer.from("fake-mp3-audio").toString("base64");
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { audio: { data: audio } } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await provider.synthesize({
      text: "Hello from CoreBlow.",
      cfg: {} as never,
      providerConfig: {
        apiKey: "sk-test",
        model: "mimo-v2-tts",
        voice: "default_en",
        style: "Bright.",
      },
      target: "audio-file",
      timeoutMs: 30000,
    });

    expect(result.outputFormat).toBe("mp3");
    expect(result.fileExtension).toBe(".mp3");
    expect(result.voiceCompatible).toBe(false);
    expect(result.audioBuffer.toString()).toBe("fake-mp3-audio");
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it("transcodes Xiaomi output to Opus for voice-note targets", async () => {
    const audio = Buffer.from("fake-mp3-audio").toString("base64");
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { audio: { data: audio } } }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    runFfmpegMock.mockImplementation(async (args: string[]) => {
      const outputPath = args[args.length - 1];
      const fs = await import("node:fs/promises");
      await fs.writeFile(outputPath, Buffer.from("fake-opus-audio"));
    });

    const result = await provider.synthesize({
      text: "Hello from CoreBlow.",
      cfg: {} as never,
      providerConfig: { apiKey: "sk-test" },
      target: "voice-note",
      timeoutMs: 30000,
    });

    expect(result.outputFormat).toBe("opus");
    expect(result.fileExtension).toBe(".opus");
    expect(result.voiceCompatible).toBe(true);
    expect(result.audioBuffer.toString()).toBe("fake-opus-audio");
    expect(runFfmpegMock).toHaveBeenCalled();
  });

  it("throws when API key is missing", async () => {
    const savedKey = process.env.XIAOMI_API_KEY;
    delete process.env.XIAOMI_API_KEY;
    try {
      await expect(
        provider.synthesize({
          text: "Test",
          cfg: {} as never,
          providerConfig: {},
          target: "audio-file",
          timeoutMs: 30000,
        }),
      ).rejects.toThrow("Xiaomi API key missing");
    } finally {
      if (savedKey === undefined) {
        delete process.env.XIAOMI_API_KEY;
      } else {
        process.env.XIAOMI_API_KEY = savedKey;
      }
    }
  });
});
