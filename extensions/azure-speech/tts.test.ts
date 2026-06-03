import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const { fetchWithSsrFGuardMock } = vi.hoisted(() => ({
  fetchWithSsrFGuardMock: vi.fn(),
}));

vi.mock("coreblow/plugin-sdk/ssrf-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("coreblow/plugin-sdk/ssrf-runtime")>();
  return {
    ...actual,
    fetchWithSsrFGuard: fetchWithSsrFGuardMock,
  };
});
import {
  azureSpeechTTS,
  buildAzureSpeechSsml,
  inferAzureSpeechFileExtension,
  isAzureSpeechVoiceCompatible,
  listAzureSpeechVoices,
  normalizeAzureSpeechBaseUrl,
} from "./tts.js";

function queueGuardedResponse(response: Response) {
  const release = vi.fn(async () => {});
  fetchWithSsrFGuardMock.mockResolvedValueOnce({ response, release });
  return { release };
}

afterAll(() => {
  vi.doUnmock("coreblow/plugin-sdk/ssrf-runtime");
  vi.resetModules();
});

describe("azure speech tts", () => {
  afterEach(() => {
    fetchWithSsrFGuardMock.mockReset();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("escapes SSML text and attributes", () => {
    expect(
      buildAzureSpeechSsml({
        text: `Tom & "Jerry" <tag>`,
        voice: `en-US-JennyNeural" xml:lang="evil`,
        lang: `en-US" bad="1`,
      }),
    ).toBe(
      `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" ` +
        `xml:lang="en-US&quot; bad=&quot;1">` +
        `<voice name="en-US-JennyNeural&quot; xml:lang=&quot;evil">` +
        `Tom &amp; "Jerry" &lt;tag&gt;</voice></speak>`,
    );
  });

  it("normalizes region and endpoint routing", () => {
    expect(normalizeAzureSpeechBaseUrl({ region: "eastus" })).toBe(
      "https://eastus.tts.speech.microsoft.com",
    );
    expect(
      normalizeAzureSpeechBaseUrl({
        endpoint: "https://eastus.tts.speech.microsoft.com/cognitiveservices/v1/",
      }),
    ).toBe("https://eastus.tts.speech.microsoft.com");
    expect(normalizeAzureSpeechBaseUrl({ baseUrl: "https://custom.example.com/" })).toBe(
      "https://custom.example.com",
    );
  });

  it("maps Azure output formats to attachment metadata", () => {
    expect(inferAzureSpeechFileExtension("audio-24khz-48kbitrate-mono-mp3")).toBe(".mp3");
    expect(inferAzureSpeechFileExtension("ogg-24khz-16bit-mono-opus")).toBe(".ogg");
    expect(inferAzureSpeechFileExtension("riff-24khz-16bit-mono-pcm")).toBe(".wav");
    expect(inferAzureSpeechFileExtension("raw-8khz-8bit-mono-mulaw")).toBe(".pcm");
    expect(isAzureSpeechVoiceCompatible("ogg-24khz-16bit-mono-opus")).toBe(true);
    expect(isAzureSpeechVoiceCompatible("webm-24khz-16bit-mono-opus")).toBe(false);
  });

  it("posts SSML to the region endpoint with Azure Speech headers", async () => {
    queueGuardedResponse(new Response(Buffer.from("mp3"), { status: 200 }));

    const result = await azureSpeechTTS({
      text: "hello",
      apiKey: "speech-key",
      region: "eastus",
      voice: "en-US-JennyNeural",
      lang: "en-US",
      outputFormat: "audio-24khz-48kbitrate-mono-mp3",
      timeoutMs: 1234,
    });

    expect(result).toEqual(Buffer.from("mp3"));
    expect(fetchWithSsrFGuardMock).toHaveBeenCalled();
  });

  it("lists voices with timeout and filters deprecated entries", async () => {
    queueGuardedResponse(
      new Response(
        JSON.stringify([
          {
            ShortName: "en-US-JennyNeural",
            DisplayName: "Jenny",
            Locale: "en-US",
            Gender: "Female",
            Status: "GA",
            VoiceTag: { VoicePersonalities: ["Warm"] },
          },
          { ShortName: "en-US-OldNeural", DisplayName: "Old", Status: "Deprecated" },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const voices = await listAzureSpeechVoices({
      apiKey: "speech-key",
      baseUrl: "https://custom.example.com",
      timeoutMs: 4321,
    });

    expect(fetchWithSsrFGuardMock).toHaveBeenCalled();
    expect(voices).toEqual([
      {
        id: "en-US-JennyNeural",
        name: "Jenny",
        description: "Warm",
        locale: "en-US",
        gender: "Female",
        personalities: ["Warm"],
      },
    ]);
  });
});
