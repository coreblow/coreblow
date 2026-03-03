import { describe, it, expect } from "vitest";
import {
  resolveProviderCapabilities,
  preservesAnthropicThinkingSignatures,
  requiresOpenAiCompatibleAnthropicToolPayload,
  usesOpenAiFunctionAnthropicToolSchema,
  usesOpenAiStringModeAnthropicToolChoice,
  supportsOpenAiCompatTurnValidation,
  usesMoonshotThinkingPayloadCompat,
  sanitizesGeminiThoughtSignatures,
  isOpenAiProviderFamily,
  isAnthropicProviderFamily,
  shouldDropThinkingBlocksForModel,
  shouldSanitizeGeminiThoughtSignaturesForModel,
  resolveTranscriptToolCallIdMode,
} from "./provider-capabilities.js";

describe("provider-capabilities — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof resolveProviderCapabilities).toBe("function");
    expect(typeof preservesAnthropicThinkingSignatures).toBe("function");
    expect(typeof requiresOpenAiCompatibleAnthropicToolPayload).toBe("function");
    expect(typeof usesOpenAiFunctionAnthropicToolSchema).toBe("function");
    expect(typeof usesOpenAiStringModeAnthropicToolChoice).toBe("function");
    expect(typeof supportsOpenAiCompatTurnValidation).toBe("function");
    expect(typeof usesMoonshotThinkingPayloadCompat).toBe("function");
    expect(typeof sanitizesGeminiThoughtSignatures).toBe("function");
    expect(typeof isOpenAiProviderFamily).toBe("function");
    expect(typeof isAnthropicProviderFamily).toBe("function");
    expect(typeof shouldDropThinkingBlocksForModel).toBe("function");
    expect(typeof shouldSanitizeGeminiThoughtSignaturesForModel).toBe("function");
    expect(typeof resolveTranscriptToolCallIdMode).toBe("function");
  });
});
