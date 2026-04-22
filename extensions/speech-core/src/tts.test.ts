/**
 * extensions/speech-core/src/tts.test.ts
 * CoreBlow — Speech Core TTS Tests
 */
import { describe, expect, it } from "vitest";
import { resolveTtsConfig } from "./tts.js";

describe("resolveTtsConfig", () => {
  it("is a function", () => {
    expect(typeof resolveTtsConfig).toBe("function");
  });
  it("returns an object for empty config", () => {
    const result = resolveTtsConfig({} as never);
    expect(typeof result).toBe("object");
  });
  it("does not throw for empty config", () => {
    expect(() => resolveTtsConfig({} as never)).not.toThrow();
  });
  it("result is non-null", () => {
    const result = resolveTtsConfig({} as never);
    expect(result).not.toBeNull();
  });
});
