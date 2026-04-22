/**
 * extensions/elevenlabs/speech-provider.test.ts
 * CoreBlow — ElevenLabs Speech Provider Tests
 */
import { describe, expect, it } from "vitest";
import {
  buildElevenLabsSpeechProvider,
  isValidVoiceId,
} from "./speech-provider.js";

describe("isValidVoiceId", () => {
  it("is a function", () => {
    expect(typeof isValidVoiceId).toBe("function");
  });
  it("returns true for a non-empty valid voice id", () => {
    expect(typeof isValidVoiceId("EXAVITQu4vr4xnSDxMaL")).toBe("boolean");
  });
  it("returns false for empty string", () => {
    expect(isValidVoiceId("")).toBe(false);
  });
  it("does not throw for any string", () => {
    expect(() => isValidVoiceId("any-string")).not.toThrow();
  });
});

describe("buildElevenLabsSpeechProvider", () => {
  it("is a function", () => {
    expect(typeof buildElevenLabsSpeechProvider).toBe("function");
  });
  it("returns a non-null object", () => {
    const p = buildElevenLabsSpeechProvider();
    expect(typeof p).toBe("object");
    expect(p).not.toBeNull();
  });
  it("does not throw", () => {
    expect(() => buildElevenLabsSpeechProvider()).not.toThrow();
  });
});
