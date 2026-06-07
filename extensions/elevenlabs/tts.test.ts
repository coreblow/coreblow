import { describe, expect, it } from "vitest";
import { elevenLabsTTSStream } from "./tts.js";

const baseParams = {
  text: "hello",
  apiKey: "test-key",
  baseUrl: "https://api.example.test",
  voiceId: "EXAVITQu4vr4xnSDxMaL",
  modelId: "eleven_multilingual_v2",
  outputFormat: "mp3_44100_128",
  voiceSettings: {
    stability: 0.5,
    similarityBoost: 0.75,
    style: 0,
    useSpeakerBoost: true,
    speed: 1,
  },
  timeoutMs: 1000,
} as const;

describe("elevenLabsTTSStream", () => {
  it("rejects invalid voice ids before network fetch", async () => {
    await expect(
      elevenLabsTTSStream({
        ...baseParams,
        voiceId: "bad-voice-id",
      }),
    ).rejects.toThrow("Invalid voiceId format");
  });
});
