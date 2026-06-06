import { describe, expect, it } from "vitest";
import { isReasoningTagProvider } from "./provider-utils.js";

describe("isReasoningTagProvider", () => {
  it.each([
    ["google", true],
    ["Google", true],
    ["google-gemini-cli", true],
    ["google-generative-ai", true],
    ["minimax", true],
    ["minimax-cn", true],
    ["anthropic", false],
    ["openai", false],
    ["openrouter", false],
    ["ollama", false],
    [null, false],
    [undefined, false],
    ["", false],
  ] as const)("resolves tagged reasoning fallback for %s", (provider, expected) => {
    expect(isReasoningTagProvider(provider)).toBe(expected);
  });
});
