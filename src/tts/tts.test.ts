import { describe, expect, it } from "vitest";
import { textToSpeech } from "./tts.js";

describe("tts runtime parity surface", () => {
  it("keeps textToSpeech runtime export importable", () => {
    expect(typeof textToSpeech).toBe("function");
  });
});
