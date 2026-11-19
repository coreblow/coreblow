import { describe, expect, it } from "vitest";
import {
  cleanupStaleProviderConfig,
  cycleReasoningEffort,
  normalizeModelId,
  splitModelRef,
} from "./model-picker-utils.js";
import type { CoreBlowConfig } from "../../config/types.js";

describe("model-picker-utils", () => {
  describe("normalizeModelId", () => {
    it("avoids duplicate provider prefixes like coreblow/coreblow/native", () => {
      expect(normalizeModelId("coreblow", "coreblow/native")).toBe("coreblow/native");
      expect(normalizeModelId("openai", "openai/gpt-4o")).toBe("openai/gpt-4o");
      expect(normalizeModelId("coreblow", "coreblow/coreblow/native")).toBe("coreblow/native");
    });

    it("prepends provider when missing from model id", () => {
      expect(normalizeModelId("anthropic", "claude-3-7-sonnet")).toBe("anthropic/claude-3-7-sonnet");
      expect(normalizeModelId("ollama", "llama3.3")).toBe("ollama/llama3.3");
    });

    it("handles empty or default inputs gracefully", () => {
      expect(normalizeModelId("", "")).toBe("coreblow/native");
      expect(normalizeModelId("coreblow", "")).toBe("coreblow/native");
    });
  });

  describe("splitModelRef", () => {
    it("splits provider and model cleanly", () => {
      expect(splitModelRef("anthropic/claude-3-7-sonnet")).toEqual({
        provider: "anthropic",
        model: "claude-3-7-sonnet",
      });
      expect(splitModelRef("openrouter/deepseek/deepseek-r1")).toEqual({
        provider: "openrouter",
        model: "deepseek/deepseek-r1",
      });
    });

    it("defaults to coreblow provider if no slash present", () => {
      expect(splitModelRef("native")).toEqual({
        provider: "coreblow",
        model: "native",
      });
      expect(splitModelRef("")).toEqual({
        provider: "coreblow",
        model: "native",
      });
    });
  });

  describe("cleanupStaleProviderConfig", () => {
    it("removes custom baseUrl when switching away from custom provider", () => {
      const cfg: CoreBlowConfig = {
        models: {
          providers: {
            custom: {
              baseUrl: "https://old-custom.local/v1",
              apiKey: "test-key",
            },
            anthropic: {
              apiKey: "ant-key",
            },
          },
        },
      } as any;

      const updated = cleanupStaleProviderConfig("custom", "anthropic", cfg);
      expect(updated.models?.providers?.custom?.baseUrl).toBeUndefined();
      expect(updated.models?.providers?.custom?.apiKey).toBe("test-key");
    });

    it("leaves config intact when switching within the same provider", () => {
      const cfg: CoreBlowConfig = {
        models: {
          providers: {
            openai: {
              apiKey: "test-openai-key",
            },
          },
        },
      } as any;

      const updated = cleanupStaleProviderConfig("openai", "openai", cfg);
      expect(updated).toEqual(cfg);
    });
  });

  describe("cycleReasoningEffort", () => {
    it("cycles effort levels to the right", () => {
      expect(cycleReasoningEffort("off", "right")).toBe("low");
      expect(cycleReasoningEffort("low", "right")).toBe("medium");
      expect(cycleReasoningEffort("medium", "right")).toBe("high");
      expect(cycleReasoningEffort("high", "right")).toBe("off");
    });

    it("cycles effort levels to the left", () => {
      expect(cycleReasoningEffort("off", "left")).toBe("high");
      expect(cycleReasoningEffort("high", "left")).toBe("medium");
      expect(cycleReasoningEffort("medium", "left")).toBe("low");
      expect(cycleReasoningEffort("low", "left")).toBe("off");
    });
  });
});
