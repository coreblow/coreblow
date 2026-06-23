import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isReasoningTagProvider,
  resolveReasoningOutputMode,
  setProviderReasoningOutputModeResolverForTest,
} from "./provider-utils.js";

const resolveProviderReasoningOutputModeWithPluginMock = vi.fn();

beforeEach(() => {
  resolveProviderReasoningOutputModeWithPluginMock.mockReset();
  resolveProviderReasoningOutputModeWithPluginMock.mockReturnValue(undefined);
  setProviderReasoningOutputModeResolverForTest(
    resolveProviderReasoningOutputModeWithPluginMock,
  );
});

describe("resolveReasoningOutputMode", () => {
  it("prefers the provider-owned output mode", () => {
    resolveProviderReasoningOutputModeWithPluginMock.mockReturnValueOnce("tagged");

    expect(
      resolveReasoningOutputMode({
        provider: "custom-provider",
        modelId: "custom-model",
        modelApi: "custom-api",
      }),
    ).toBe("tagged");
    expect(resolveProviderReasoningOutputModeWithPluginMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "custom-provider",
        context: expect.objectContaining({
          modelId: "custom-model",
          modelApi: "custom-api",
        }),
      }),
    );
  });

  it("defaults to native when neither plugin nor built-in policy requires tags", () => {
    expect(resolveReasoningOutputMode({ provider: "openai" })).toBe("native");
  });
});

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
