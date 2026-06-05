import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import { describe, expect, it } from "vitest";
import {
  applyConfigDefaults,
  normalizeConfig,
  resolveThinkingProfile,
} from "./provider-policy-api.js";

function createProviderConfig(): ModelProviderConfig {
  return {
    baseUrl: "https://api.anthropic.com",
    models: [
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        reasoning: true,
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200_000,
        maxTokens: 64_000,
      },
    ],
  };
}

describe("anthropic provider policy api", () => {
  it("normalizes Anthropic and Claude CLI provider configs to anthropic-messages", () => {
    expect(normalizeConfig({ provider: "anthropic", providerConfig: createProviderConfig() }).api).toBe(
      "anthropic-messages",
    );
    expect(normalizeConfig({ provider: "claude-cli", providerConfig: createProviderConfig() }).api).toBe(
      "anthropic-messages",
    );
  });

  it("preserves unrelated provider config identity", () => {
    const providerConfig = createProviderConfig();
    expect(normalizeConfig({ provider: "openai", providerConfig })).toBe(providerConfig);
  });

  it("applies API-key config defaults without loading the full plugin", () => {
    const next = applyConfigDefaults({
      config: {
        auth: {
          profiles: {
            "anthropic:api": { provider: "anthropic", mode: "api_key" },
          },
        },
        agents: { defaults: {} },
      },
      env: {},
    });

    expect(next.agents?.defaults?.contextPruning).toEqual({
      mode: "cache-ttl",
      ttl: "1h",
    });
    expect(next.agents?.defaults?.heartbeat).toEqual({ every: "30m" });
  });

  it("exposes Anthropic thinking profile policy", () => {
    const opus = resolveThinkingProfile({
      provider: "anthropic",
      modelId: "claude-opus-4-6",
    });
    expect(opus?.levels.map((level) => level.id)).toContain("xhigh");
    expect(opus?.defaultLevel).toBe("adaptive");

    expect(
      resolveThinkingProfile({ provider: "openai", modelId: "claude-opus-4-6" }),
    ).toBeNull();
  });
});
