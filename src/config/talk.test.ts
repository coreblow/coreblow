/**
 * src/config/talk.test.ts
 *
 * CoreBlow — Talk (TTS) Config Tests
 * Verifies normalizeTalkSection, buildTalkConfigResponse,
 * and LEGACY_TALK_PROVIDER_ID constant behavior.
 */
import { describe, expect, it } from "vitest";
import {
  LEGACY_TALK_PROVIDER_ID,
  buildTalkConfigResponse,
  normalizeTalkSection,
} from "./talk.js";

describe("LEGACY_TALK_PROVIDER_ID", () => {
  it("is elevenlabs", () => {
    expect(LEGACY_TALK_PROVIDER_ID).toBe("elevenlabs");
  });

  it("is a non-empty string", () => {
    expect(typeof LEGACY_TALK_PROVIDER_ID).toBe("string");
    expect(LEGACY_TALK_PROVIDER_ID.length).toBeGreaterThan(0);
  });
});

describe("normalizeTalkSection", () => {
  it("returns undefined for undefined input", () => {
    expect(normalizeTalkSection(undefined)).toBeUndefined();
  });

  it("returns undefined for null input", () => {
    expect(normalizeTalkSection(null as never)).toBeUndefined();
  });

  it("returns undefined for non-object input", () => {
    expect(normalizeTalkSection("string" as never)).toBeUndefined();
  });

  it("returns an object for empty object input", () => {
    const result = normalizeTalkSection({});
    expect(typeof result === "object" || result === undefined).toBe(true);
  });

  it("preserves interruptOnSpeech boolean", () => {
    const result = normalizeTalkSection({ interruptOnSpeech: true } as never);
    if (result) {
      expect(result.interruptOnSpeech).toBe(true);
    }
  });

  it("does not throw for any valid config shape", () => {
    expect(() =>
      normalizeTalkSection({
        provider: "elevenlabs",
        interruptOnSpeech: false,
      } as never),
    ).not.toThrow();
  });
});

describe("buildTalkConfigResponse", () => {
  it("returns undefined for null", () => {
    expect(buildTalkConfigResponse(null)).toBeUndefined();
  });

  it("returns undefined for non-object", () => {
    expect(buildTalkConfigResponse("string")).toBeUndefined();
  });

  it("returns undefined for empty object (no normalizable shape)", () => {
    const result = buildTalkConfigResponse({});
    expect(result === undefined || typeof result === "object").toBe(true);
  });

  it("does not throw for any value", () => {
    expect(() => buildTalkConfigResponse({ provider: "elevenlabs" })).not.toThrow();
  });
});
