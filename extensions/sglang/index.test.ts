import { resolveTranscriptPolicy } from "../../src/agents/transcript-policy.js";
import { registerSingleProviderPlugin } from "../../test/helpers/extensions/plugin-registration.js";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";

describe("sglang provider plugin", () => {
  it("keeps OpenAI-compatible replay validation without dropping reasoning history by default", () => {
    const provider = registerSingleProviderPlugin(plugin);
    const policy = resolveTranscriptPolicy({
      provider: provider.id,
      modelApi: "openai-completions",
      modelId: "moonshotai/kimi-k2-thinking",
    });

    expect(policy).toMatchObject({
      sanitizeToolCallIds: true,
      toolCallIdMode: "strict",
      applyGoogleTurnOrdering: true,
      validateGeminiTurns: true,
      validateAnthropicTurns: true,
      dropThinkingBlocks: false,
    });
  });

  it("drops historical reasoning blocks for Gemma 4 chat-completions models", () => {
    const provider = registerSingleProviderPlugin(plugin);
    const policy = resolveTranscriptPolicy({
      provider: provider.id,
      modelApi: "openai-completions",
      modelId: "google/gemma-4-26b-a4b-it",
    });

    expect(policy.dropThinkingBlocks).toBe(true);
  });
});
