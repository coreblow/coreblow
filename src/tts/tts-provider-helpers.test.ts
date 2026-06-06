import { describe, expect, it } from "vitest";
import {
  normalizeApplyTextNormalization,
  normalizeLanguageCode,
  normalizeSeed,
  requireInRange,
} from "./tts-provider-helpers.js";

describe("tts provider helpers", () => {
  it("normalizes bounded provider inputs", () => {
    expect(normalizeLanguageCode(" EN ")).toBe("en");
    expect(normalizeApplyTextNormalization("Auto")).toBe("auto");
    expect(normalizeSeed(1.8)).toBe(1);
    expect(() => requireInRange(5, 1, 10, "speed")).not.toThrow();
  });

  it("rejects invalid provider inputs", () => {
    expect(() => normalizeLanguageCode("eng")).toThrow("languageCode");
    expect(() => normalizeApplyTextNormalization("sometimes")).toThrow("applyTextNormalization");
    expect(() => normalizeSeed(-1)).toThrow("seed");
    expect(() => requireInRange(11, 1, 10, "speed")).toThrow("speed");
  });
});
