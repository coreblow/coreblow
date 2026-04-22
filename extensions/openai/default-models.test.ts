/**
 * extensions/openai/default-models.test.ts
 *
 * CoreBlow — OpenAI Extension Default Models Tests
 * Verifies default model constants are valid non-empty strings.
 */
import { describe, expect, it } from "vitest";
import {
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
