import { describe, expect, it } from "vitest";
import { resolveTranscriptPolicy } from "../../src/agents/transcript-policy.js";
import { registerSingleProviderPlugin } from "../../test/helpers/extensions/plugin-registration.js";
import xiaomiPlugin from "./index.js";

describe("xiaomi provider plugin", () => {
  it("registers Xiaomi with api-key auth metadata", () => {
    const provider = registerSingleProviderPlugin(xiaomiPlugin);

    expect(provider.id).toBe("xiaomi");
    expect(provider.label).toBe("Xiaomi");
    expect(provider.envVars).toEqual(["XIAOMI_API_KEY"]);
    expect(provider.auth).toHaveLength(1);
  });

  it("builds the static Xiaomi model catalog with reasoning flags", async () => {
    const provider = registerSingleProviderPlugin(xiaomiPlugin);
    const catalog = await provider.catalog?.run({
      config: {},
      env: {},
      resolveProviderApiKey: () => ({ apiKey: "test-key" }),
      resolveProviderAuth: () => ({
        apiKey: "test-key",
        mode: "api_key",
        source: "env",
      }),
    } as never);

    if (!catalog || !("provider" in catalog)) {
      throw new Error("expected single-provider catalog");
    }

    expect(catalog.provider.api).toBe("openai-completions");
    expect(catalog.provider.baseUrl).toBe("https://api.xiaomimimo.com/v1");
    expect(catalog.provider.models?.map((m) => m.id)).toEqual([
      "mimo-v2-flash",
      "mimo-v2-pro",
      "mimo-v2-omni",
    ]);
    expect(catalog.provider.models?.find((m) => m.id === "mimo-v2-pro")?.reasoning).toBe(true);
    expect(catalog.provider.models?.find((m) => m.id === "mimo-v2-flash")?.reasoning).toBe(false);
  });

  it("uses OpenAI-compatible transcript validation for Xiaomi models", () => {
    const provider = registerSingleProviderPlugin(xiaomiPlugin);
    const policy = resolveTranscriptPolicy({
      provider: provider.id,
      modelApi: "openai-completions",
      modelId: "mimo-v2.5-pro",
    });

    expect(policy).toMatchObject({
      sanitizeToolCallIds: true,
      toolCallIdMode: "strict",
      validateGeminiTurns: true,
      validateAnthropicTurns: true,
      dropThinkingBlocks: false,
    });
  });

  it("marks resolved Xiaomi models to omit empty array items and exposes reasoning hooks", () => {
    const provider = registerSingleProviderPlugin(xiaomiPlugin);

    const normalized = provider.normalizeResolvedModel?.({
      provider: "xiaomi",
      modelId: "mimo-v2.5",
      modelApi: "openai-completions",
      model: { id: "mimo-v2.5", compat: {} },
    } as never);
    expect(
      (normalized?.compat as { omitEmptyArrayItems?: unknown } | undefined)?.omitEmptyArrayItems,
    ).toBe(true);

    expect(
      provider.supportsXHighThinking?.({ provider: "xiaomi", modelId: "mimo-v2.5-pro" } as never),
    ).toBe(true);
    expect(
      provider.resolveDefaultThinkingLevel?.({
        provider: "xiaomi",
        modelId: "mimo-v2.5-pro",
      } as never),
    ).toBe("high");
    expect(
      provider.isModernModelRef?.({ provider: "xiaomi", modelId: "mimo-v2.5-pro" } as never),
    ).toBe(true);
    expect(
      provider.isModernModelRef?.({ provider: "xiaomi", modelId: "mimo-v2-flash" } as never),
    ).toBe(false);
  });
});
