import type { ProviderRuntimeModel } from "coreblow/plugin-sdk/plugin-entry";
import { describe, expect, it } from "vitest";
import { registerSingleProviderPlugin } from "../../test/helpers/extensions/plugin-registration.js";
import fireworksPlugin from "./index.js";
import {
  FIREWORKS_BASE_URL,
  FIREWORKS_DEFAULT_CONTEXT_WINDOW,
  FIREWORKS_DEFAULT_MAX_TOKENS,
  FIREWORKS_DEFAULT_MODEL_ID,
  FIREWORKS_K2_6_CONTEXT_WINDOW,
  FIREWORKS_K2_6_MAX_TOKENS,
  FIREWORKS_K2_6_MODEL_ID,
} from "./provider-catalog.js";
import { resolveThinkingProfile } from "./provider-policy-api.js";

function createFireworksDefaultRuntimeModel(params: { reasoning: boolean }): ProviderRuntimeModel {
  return {
    id: FIREWORKS_DEFAULT_MODEL_ID,
    name: FIREWORKS_DEFAULT_MODEL_ID,
    provider: "fireworks",
    api: "openai-completions",
    baseUrl: FIREWORKS_BASE_URL,
    reasoning: params.reasoning,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: FIREWORKS_DEFAULT_CONTEXT_WINDOW,
    maxTokens: FIREWORKS_DEFAULT_MAX_TOKENS,
  };
}

function createDynamicModelContext(params: { modelId: string; models: ProviderRuntimeModel[] }) {
  return {
    provider: "fireworks",
    modelId: params.modelId,
    modelRegistry: {
      find: (provider: string, modelId: string) =>
        provider === "fireworks"
          ? (params.models.find((model) => model.id === modelId) ?? null)
          : null,
    },
  } as never;
}

describe("fireworks provider plugin", () => {
  it("registers Fireworks with api-key auth wizard metadata", () => {
    const provider = registerSingleProviderPlugin(fireworksPlugin);

    expect(provider.id).toBe("fireworks");
    expect(provider.label).toBe("Fireworks");
    expect(provider.aliases).toEqual(["fireworks-ai"]);
    expect(provider.envVars).toEqual(["FIREWORKS_API_KEY"]);
    expect(provider.auth).toHaveLength(1);
    expect(provider.auth[0]?.id).toBe("api-key");
    expect(provider.auth[0]?.wizard?.choiceId).toBe("fireworks-api-key");
  });

  it("builds the Fireworks catalog", async () => {
    const provider = registerSingleProviderPlugin(fireworksPlugin);
    const catalogResult = await provider.catalog?.run({
      env: process.env,
      config: {},
      resolveProviderApiKey: () => ({ apiKey: "fw-key", source: "env" }),
    } as never);
    const catalogProvider =
      catalogResult && "provider" in catalogResult ? catalogResult.provider : null;

    expect(catalogProvider?.api).toBe("openai-completions");
    expect(catalogProvider?.baseUrl).toBe(FIREWORKS_BASE_URL);
    const models = catalogProvider?.models;
    expect(models?.map((model: { id: string }) => model.id)).toEqual([
      FIREWORKS_K2_6_MODEL_ID,
      FIREWORKS_DEFAULT_MODEL_ID,
    ]);
    expect(models?.[0]?.reasoning).toBe(false);
    expect(models?.[0]?.input).toEqual(["text", "image"]);
    expect(models?.[0]?.contextWindow).toBe(FIREWORKS_K2_6_CONTEXT_WINDOW);
    expect(models?.[0]?.maxTokens).toBe(FIREWORKS_K2_6_MAX_TOKENS);
    expect(models?.[1]?.reasoning).toBe(false);
    expect(models?.[1]?.input).toEqual(["text", "image"]);
    expect(models?.[1]?.contextWindow).toBe(FIREWORKS_DEFAULT_CONTEXT_WINDOW);
    expect(models?.[1]?.maxTokens).toBe(FIREWORKS_DEFAULT_MAX_TOKENS);
  });

  it("resolves forward-compat Fireworks model ids from the default template", () => {
    const provider = registerSingleProviderPlugin(fireworksPlugin);
    const resolved = provider.resolveDynamicModel?.(
      createDynamicModelContext({
        modelId: "accounts/fireworks/models/qwen3.6-plus",
        models: [createFireworksDefaultRuntimeModel({ reasoning: true })],
      }),
    );

    expect(resolved).toMatchObject({
      provider: "fireworks",
      id: "accounts/fireworks/models/qwen3.6-plus",
      api: "openai-completions",
      baseUrl: FIREWORKS_BASE_URL,
      reasoning: true,
    });
  });

  it("disables reasoning metadata for Fireworks Kimi dynamic models", () => {
    const provider = registerSingleProviderPlugin(fireworksPlugin);
    const ids = [
      "accounts/fireworks/models/kimi-k2p5",
      "accounts/fireworks/routers/kimi-k2.5-turbo",
      "accounts/fireworks/models/kimi-k2p6",
    ];

    for (const modelId of ids) {
      const resolved = provider.resolveDynamicModel?.(
        createDynamicModelContext({
          modelId,
          models: [createFireworksDefaultRuntimeModel({ reasoning: false })],
        }),
      );
      expect(resolved?.provider).toBe("fireworks");
      expect(resolved?.id).toBe(modelId);
      expect(resolved?.reasoning).toBe(false);
    }
  });

  it("exposes off-only thinking policy for Fireworks Kimi models", () => {
    const provider = registerSingleProviderPlugin(fireworksPlugin);

    expect(
      provider.resolveDefaultThinkingLevel?.({ modelId: FIREWORKS_K2_6_MODEL_ID } as never),
    ).toBe("off");
    expect(provider.isModernModelRef?.({ modelId: FIREWORKS_K2_6_MODEL_ID } as never)).toBe(true);
    expect(
      resolveThinkingProfile({
        modelId: "accounts/fireworks/routers/kimi-k2p5-turbo",
      }),
    ).toEqual({
      levels: [{ id: "off" }],
      defaultLevel: "off",
    });
    expect(
      resolveThinkingProfile({
        modelId: "accounts/fireworks/models/qwen3.6-plus",
      }),
    ).toBeUndefined();
  });
});
