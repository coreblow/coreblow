import { describe, expect, it } from "vitest";
import { createOpenAiCompatibleSpeechProvider } from "./openai-compatible-speech-provider.js";

describe("OpenAI-compatible speech provider helper", () => {
  it("builds provider metadata and config readers", async () => {
    const provider = createOpenAiCompatibleSpeechProvider({
      id: "sample",
      label: "Sample",
      autoSelectOrder: 10,
      models: ["tts-1"],
      voices: ["alloy"],
      defaultModel: "tts-1",
      defaultVoice: "alloy",
      defaultBaseUrl: "https://sample.example/v1",
      envKey: "SAMPLE_API_KEY",
      responseFormats: ["mp3"],
      defaultResponseFormat: "mp3",
      voiceCompatibleResponseFormats: ["mp3"],
    });

    expect(provider.id).toBe("sample");
    expect(provider.resolveConfig?.({ rawConfig: { providers: { sample: { apiKey: "k" } } }, cfg: {} as never, timeoutMs: 1 }).apiKey).toBe("k");
    await expect(provider.listVoices?.({})).resolves.toEqual([{ id: "alloy", name: "alloy" }]);
  });
});
