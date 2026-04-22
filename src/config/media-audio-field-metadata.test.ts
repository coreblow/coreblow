/**
 * src/config/media-audio-field-metadata.test.ts
 *
 * CoreBlow — Media Audio Field Metadata Tests
 * Verifies MEDIA_AUDIO_FIELD_KEYS and MEDIA_AUDIO_FIELD_HELP
 * contain expected field paths and help strings.
 */
import { describe, expect, it } from "vitest";
import {
  MEDIA_AUDIO_FIELD_HELP,
  MEDIA_AUDIO_FIELD_KEYS,
} from "./media-audio-field-metadata.js";

describe("MEDIA_AUDIO_FIELD_KEYS", () => {
  it("is a non-empty readonly array", () => {
    expect(Array.isArray(MEDIA_AUDIO_FIELD_KEYS)).toBe(true);
    expect(MEDIA_AUDIO_FIELD_KEYS.length).toBeGreaterThan(0);
  });

  it("contains tools.media.audio.enabled", () => {
    expect(MEDIA_AUDIO_FIELD_KEYS).toContain("tools.media.audio.enabled");
  });

  it("contains tools.media.audio.maxBytes", () => {
    expect(MEDIA_AUDIO_FIELD_KEYS).toContain("tools.media.audio.maxBytes");
  });

  it("all keys start with tools.media.audio.", () => {
    for (const key of MEDIA_AUDIO_FIELD_KEYS) {
      expect(key.startsWith("tools.media.audio.")).toBe(true);
    }
  });

  it("has no duplicate keys", () => {
    const unique = new Set(MEDIA_AUDIO_FIELD_KEYS);
    expect(unique.size).toBe(MEDIA_AUDIO_FIELD_KEYS.length);
  });
});

describe("MEDIA_AUDIO_FIELD_HELP", () => {
  it("is a non-null object", () => {
    expect(typeof MEDIA_AUDIO_FIELD_HELP).toBe("object");
    expect(MEDIA_AUDIO_FIELD_HELP).not.toBeNull();
  });

  it("has help text for every MEDIA_AUDIO_FIELD_KEYS entry", () => {
    for (const key of MEDIA_AUDIO_FIELD_KEYS) {
      expect(key in MEDIA_AUDIO_FIELD_HELP).toBe(true);
    }
  });

  it("all help texts are non-empty strings", () => {
    for (const [, text] of Object.entries(MEDIA_AUDIO_FIELD_HELP)) {
      expect(typeof text).toBe("string");
      expect((text as string).length).toBeGreaterThan(0);
    }
  });

  it("enabled help text mentions enable or audio", () => {
    const text = MEDIA_AUDIO_FIELD_HELP["tools.media.audio.enabled"];
    expect(text.toLowerCase()).toMatch(/audio|enabl/);
  });
});
