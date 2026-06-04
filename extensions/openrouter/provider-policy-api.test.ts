import { describe, expect, it } from "vitest";
import {
  isOpenRouterDeepSeekV4ModelId,
  normalizeOpenRouterModelId,
  resolveOpenRouterThinkingProfile,
  supportsOpenRouterXHighThinking,
} from "./api.js";
import { createOpenrouterProvider } from "./provider-contract-api.js";

describe("openrouter provider policy", () => {
  it("normalizes OpenRouter-prefixed model ids", () => {
    expect(normalizeOpenRouterModelId("openrouter/deepseek/deepseek-v4-pro")).toBe(
      "deepseek/deepseek-v4-pro",
    );
    expect(normalizeOpenRouterModelId("DEEPSEEK/DEEPSEEK-V4-FLASH:free")).toBe(
      "deepseek/deepseek-v4-flash:free",
    );
    expect(normalizeOpenRouterModelId(null)).toBeUndefined();
  });

  it("exposes DeepSeek v4 xhigh thinking policy", () => {
    expect(isOpenRouterDeepSeekV4ModelId("openrouter/deepseek/deepseek-v4-pro")).toBe(true);
    expect(supportsOpenRouterXHighThinking("deepseek/deepseek-v4-flash")).toBe(true);
    expect(resolveOpenRouterThinkingProfile("deepseek/deepseek-v4-pro")).toEqual({
      levels: [
        { id: "off" },
        { id: "minimal" },
        { id: "low" },
        { id: "medium" },
        { id: "high" },
        { id: "xhigh" },
      ],
      defaultLevel: "high",
    });
    expect(resolveOpenRouterThinkingProfile("anthropic/claude-opus-4-6")).toBeUndefined();
  });

  it("builds the public provider contract facade", () => {
    const provider = createOpenrouterProvider();
    expect(provider.id).toBe("openrouter");
    expect(provider.envVars).toEqual(["OPENROUTER_API_KEY"]);
    expect(provider.auth.map((method) => method.id)).toEqual(["api-key"]);
  });
});
