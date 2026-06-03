import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import { describe, expect, it } from "vitest";
import { normalizeConfig, resolveThinkingProfile } from "./provider-policy-api.js";
import { createDeepSeekV4ThinkingWrapper } from "./stream.js";

describe("deepseek provider-policy-api", () => {
  it("advertises max thinking levels for DeepSeek V4 models", () => {
    const expectedV4Levels = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];

    expect(
      resolveThinkingProfile({
        provider: "deepseek",
        modelId: "deepseek-v4-pro",
      })?.levels.map((level) => level.id),
    ).toEqual(expectedV4Levels);
    expect(
      resolveThinkingProfile({
        provider: "deepseek",
        modelId: "deepseek-v4-flash",
      })?.defaultLevel,
    ).toBe("high");
    expect(
      resolveThinkingProfile({
        provider: "deepseek",
        modelId: "deepseek-chat",
      }),
    ).toBe(undefined);
    expect(
      resolveThinkingProfile({
        provider: "openrouter",
        modelId: "deepseek-v4-pro",
      }),
    ).toBe(null);
  });

  it("hydrates contextWindow and cost from catalog for known models", () => {
    const providerConfig = {
      baseUrl: "https://api.deepseek.com",
      api: "openai-completions",
      models: [
        {
          id: "deepseek-v4-flash",
          name: "DeepSeek V4 Flash",
          reasoning: true,
          input: ["text"],
        },
      ],
    } as unknown as ModelProviderConfig;

    const result = normalizeConfig({ provider: "deepseek", providerConfig });
    const model = result.models?.[0];
    expect(model?.contextWindow).toBe(1_000_000);
    expect(model?.maxTokens).toBe(384_000);
    expect(model?.cost).toEqual({
      input: 0.14,
      output: 0.28,
      cacheRead: 0.028,
      cacheWrite: 0,
    });
  });

  it("preserves explicit user overrides", () => {
    const userCost = { input: 99, output: 99, cacheRead: 99, cacheWrite: 99 };
    const providerConfig: ModelProviderConfig = {
      baseUrl: "https://api.deepseek.com",
      api: "openai-completions",
      models: [
        {
          id: "deepseek-v4-flash",
          name: "DeepSeek V4 Flash",
          reasoning: true,
          input: ["text"],
          contextWindow: 500_000,
          maxTokens: 100_000,
          cost: userCost,
        },
      ],
    };

    const result = normalizeConfig({ provider: "deepseek", providerConfig });
    const model = result.models?.[0];
    expect(model?.contextWindow).toBe(500_000);
    expect(model?.maxTokens).toBe(100_000);
    expect(model?.cost).toEqual(userCost);
  });

  it("patches DeepSeek V4 payloads for thinking replay expectations", () => {
    let capturedPayload: Record<string, unknown> | undefined;
    const baseStreamFn: StreamFn = (_model, _context, options) => {
      const payload: Record<string, unknown> = {
        thinking: { type: "enabled" },
        reasoning: { enabled: true },
        messages: [
          { role: "user", content: "hi" },
          { role: "assistant", content: "ok" },
        ],
      };
      options?.onPayload?.(payload as never, {} as never);
      capturedPayload = payload;
      return {} as ReturnType<StreamFn>;
    };

    const wrapped = createDeepSeekV4ThinkingWrapper(baseStreamFn, "high");
    wrapped(
      { provider: "deepseek", id: "deepseek-v4-pro" } as never,
      {} as never,
      {},
    );

    expect(capturedPayload).not.toHaveProperty("reasoning");
    expect(capturedPayload).not.toHaveProperty("reasoning_effort");
    expect(capturedPayload).not.toHaveProperty("thinking");
    expect((capturedPayload?.messages as Array<Record<string, unknown>>)[1]?.reasoning_content).toBe("");
  });
});
