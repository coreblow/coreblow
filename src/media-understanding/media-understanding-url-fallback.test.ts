import { describe, expect, it } from "vitest";
import { coerceOpenAiCompatibleVideoText } from "./openai-compatible-video.js";

describe("media URL fallback response", () => {
  it("extracts text arrays and reasoning fallback", () => {
    expect(coerceOpenAiCompatibleVideoText({ choices: [{ message: { content: [{ text: "a" }, { text: "b" }] } }] })).toBe("a\nb");
    expect(coerceOpenAiCompatibleVideoText({ choices: [{ message: { reasoning_content: "fallback" } }] })).toBe("fallback");
  });
});
