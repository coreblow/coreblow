/**
 * extensions/openai/default-models.test.ts
 *
 * CoreBlow — OpenAI Extension Default Models Tests
 * Verifies default model constants are valid non-empty strings.
 */
import { describe, expect, it } from "vitest";
import type { CoreBlowConfig } from "coreblow/plugin-sdk/provider-onboard";
import {
  applyOpenAIConfig,
  applyOpenAIProviderConfig,
  OPENAI_CODEX_DEFAULT_MODEL,
  OPENAI_DEFAULT_AUDIO_TRANSCRIPTION_MODEL,
  OPENAI_DEFAULT_IMAGE_MODEL,
  OPENAI_DEFAULT_MODEL,
  OPENAI_DEFAULT_TTS_MODEL,
  OPENAI_DEFAULT_TTS_VOICE,
} from "./default-models.js";

describe("OpenAI default model constants", () => {
  it("OPENAI_DEFAULT_MODEL is a non-empty string", () => {
    expect(typeof OPENAI_DEFAULT_MODEL).toBe("string");
    expect(OPENAI_DEFAULT_MODEL.length).toBeGreaterThan(0);
  });

  it("OPENAI_DEFAULT_MODEL starts with openai/", () => {
    expect(OPENAI_DEFAULT_MODEL.startsWith("openai/")).toBe(true);
  });

  it("OPENAI_CODEX_DEFAULT_MODEL is a non-empty string", () => {
    expect(typeof OPENAI_CODEX_DEFAULT_MODEL).toBe("string");
    expect(OPENAI_CODEX_DEFAULT_MODEL.length).toBeGreaterThan(0);
  });

  it("OPENAI_CODEX_DEFAULT_MODEL starts with openai-codex/", () => {
    expect(OPENAI_CODEX_DEFAULT_MODEL.startsWith("openai-codex/")).toBe(true);
  });

  it("OPENAI_DEFAULT_IMAGE_MODEL is a non-empty string", () => {
    expect(typeof OPENAI_DEFAULT_IMAGE_MODEL).toBe("string");
    expect(OPENAI_DEFAULT_IMAGE_MODEL.length).toBeGreaterThan(0);
  });

  it("OPENAI_DEFAULT_TTS_MODEL is a non-empty string", () => {
    expect(typeof OPENAI_DEFAULT_TTS_MODEL).toBe("string");
    expect(OPENAI_DEFAULT_TTS_MODEL.length).toBeGreaterThan(0);
  });

  it("OPENAI_DEFAULT_TTS_VOICE is a non-empty string", () => {
    expect(typeof OPENAI_DEFAULT_TTS_VOICE).toBe("string");
    expect(OPENAI_DEFAULT_TTS_VOICE.length).toBeGreaterThan(0);
  });

  it("OPENAI_DEFAULT_AUDIO_TRANSCRIPTION_MODEL is a non-empty string", () => {
    expect(typeof OPENAI_DEFAULT_AUDIO_TRANSCRIPTION_MODEL).toBe("string");
    expect(OPENAI_DEFAULT_AUDIO_TRANSCRIPTION_MODEL.length).toBeGreaterThan(0);
  });

  it("all model constants are distinct", () => {
    const models = [
      OPENAI_DEFAULT_MODEL,
      OPENAI_CODEX_DEFAULT_MODEL,
      OPENAI_DEFAULT_IMAGE_MODEL,
      OPENAI_DEFAULT_TTS_MODEL,
    ];
    const unique = new Set(models);
    expect(unique.size).toBe(models.length);
  });
});

describe("openai default models", () => {
  it("adds allowlist entry for the default model", () => {
    const next = applyOpenAIProviderConfig({});
    expect(Object.keys(next.agents?.defaults?.models ?? {})).toEqual([OPENAI_DEFAULT_MODEL]);
    expect(next.agents?.defaults?.models?.[OPENAI_DEFAULT_MODEL]).toEqual({ alias: "GPT" });
  });

  it("preserves existing alias for the default model", () => {
    const next = applyOpenAIProviderConfig({
      agents: {
        defaults: {
          models: {
            [OPENAI_DEFAULT_MODEL]: { alias: "My GPT" },
          },
        },
      },
    });
    expect(next.agents?.defaults?.models?.[OPENAI_DEFAULT_MODEL]?.alias).toBe("My GPT");
  });

  it("sets the default model when it is unset", () => {
    const next = applyOpenAIConfig({});
    expect(next.agents?.defaults?.model).toEqual({ primary: OPENAI_DEFAULT_MODEL });
  });

  it("overrides model.primary while preserving fallbacks", () => {
    const next = applyOpenAIConfig({
      agents: { defaults: { model: { primary: "anthropic/claude-opus-4-6", fallbacks: [] } } },
    } as CoreBlowConfig);
    expect(next.agents?.defaults?.model).toEqual({ primary: OPENAI_DEFAULT_MODEL, fallbacks: [] });
  });
});
