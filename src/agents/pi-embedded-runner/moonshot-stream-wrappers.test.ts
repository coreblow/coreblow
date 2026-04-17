import { describe, expect, it } from "vitest";
import { shouldApplyMoonshotPayloadCompat } from "./moonshot-stream-wrappers.js";

describe("moonshot stream wrappers", () => {
  it("enables compat for moonshot provider", () => {
    expect(
      shouldApplyMoonshotPayloadCompat({ provider: "moonshot", modelId: "kimi-k2.5" }),
    ).toBe(true);
  });

  it("enables compat for kimi model ids on other providers", () => {
    expect(
      shouldApplyMoonshotPayloadCompat({ provider: "ollama", modelId: "kimi-k2.5:cloud" }),
    ).toBe(true);
  });

  it("disables compat for non-moonshot models", () => {
    expect(
      shouldApplyMoonshotPayloadCompat({ provider: "openai", modelId: "gpt-5.4" }),
    ).toBe(false);
  });
});
