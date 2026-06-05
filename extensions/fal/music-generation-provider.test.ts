import { describe, expect, it } from "vitest";
import {
  buildFalMusicGenerationProvider,
  buildFalMusicRequestBody,
} from "./music-generation-provider.js";

describe("fal music generation provider contract", () => {
  it("advertises fal music model metadata", () => {
    const provider = buildFalMusicGenerationProvider();

    expect(provider.id).toBe("fal");
    expect(provider.defaultModel).toBe("fal-ai/minimax-music/v2.6");
    expect(provider.models).toContain("fal-ai/stable-audio-25/text-to-audio");
  });

  it("maps MiniMax music request controls", () => {
    expect(
      buildFalMusicRequestBody({
        prompt: "city pop chorus",
        lyrics: "[Verse]\nNeon rain",
        durationSeconds: 42,
        format: "mp3",
      }),
    ).toEqual({
      prompt: "city pop chorus",
      lyrics: "[Verse]\nNeon rain",
      duration: 42,
      audio_setting: {
        sample_rate: 44_100,
        bitrate: 256_000,
        format: "mp3",
      },
    });
  });

  it("maps ACE-Step and Stable Audio duration controls", () => {
    expect(
      buildFalMusicRequestBody({
        model: "fal-ai/ace-step/prompt-to-audio",
        prompt: "lofi beach loop",
        instrumental: true,
        durationSeconds: 30,
      }),
    ).toEqual({
      prompt: "lofi beach loop",
      instrumental: true,
      duration: 30,
    });
    expect(
      buildFalMusicRequestBody({
        model: "fal-ai/stable-audio-25/text-to-audio",
        prompt: "orchestral hit",
        durationSeconds: 12,
      }),
    ).toEqual({
      prompt: "orchestral hit",
      seconds_total: 12,
    });
  });
});
