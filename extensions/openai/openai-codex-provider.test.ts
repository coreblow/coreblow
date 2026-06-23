import { beforeEach, describe, expect, it, vi } from "vitest";

const refreshOpenAICodexTokenMock = vi.hoisted(() => vi.fn());

vi.mock("./openai-codex-provider.runtime.js", () => ({
  refreshOpenAICodexToken: refreshOpenAICodexTokenMock,
}));

let buildOpenAICodexProviderPlugin: typeof import("./openai-codex-provider.js").buildOpenAICodexProviderPlugin;

function createCodexRegistry() {
  return {
    find(providerId: string, modelId: string) {
      if (providerId !== "openai-codex" || !["gpt-5.3-codex", "gpt-5.2-codex"].includes(modelId)) {
        return null;
      }
      return {
        id: modelId,
        name: modelId,
        provider: "openai-codex",
        api: "openai-codex-responses",
        baseUrl: "https://chatgpt.com/backend-api/codex",
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 272_000,
        maxTokens: 128_000,
      };
    },
  };
}

describe("openai codex provider", () => {
  beforeEach(async () => {
    vi.resetModules();
    refreshOpenAICodexTokenMock.mockReset();
    ({ buildOpenAICodexProviderPlugin } = await import("./openai-codex-provider.js"));
  });

  it("falls back to the cached credential when accountId extraction fails", async () => {
    const provider = buildOpenAICodexProviderPlugin();
    const credential = {
      type: "oauth" as const,
      provider: "openai-codex",
      access: "cached-access-token",
      refresh: "refresh-token",
      expires: Date.now() - 60_000,
    };
    refreshOpenAICodexTokenMock.mockRejectedValueOnce(
      new Error("Failed to extract accountId from token"),
    );

    await expect(provider.refreshOAuth?.(credential)).resolves.toEqual(credential);
  });

  it("rethrows unrelated refresh failures", async () => {
    const provider = buildOpenAICodexProviderPlugin();
    const credential = {
      type: "oauth" as const,
      provider: "openai-codex",
      access: "cached-access-token",
      refresh: "refresh-token",
      expires: Date.now() - 60_000,
    };
    refreshOpenAICodexTokenMock.mockRejectedValueOnce(new Error("invalid_grant"));

    await expect(provider.refreshOAuth?.(credential)).rejects.toThrow("invalid_grant");
  });

  it("merges refreshed oauth credentials", async () => {
    const provider = buildOpenAICodexProviderPlugin();
    const credential = {
      type: "oauth" as const,
      provider: "openai-codex",
      access: "cached-access-token",
      refresh: "refresh-token",
      expires: Date.now() - 60_000,
      email: "user@example.com",
      displayName: "User",
    };
    refreshOpenAICodexTokenMock.mockResolvedValueOnce({
      access: "next-access",
      refresh: "next-refresh",
      expires: Date.now() + 60_000,
    });

    await expect(provider.refreshOAuth?.(credential)).resolves.toEqual({
      ...credential,
      access: "next-access",
      refresh: "next-refresh",
      expires: expect.any(Number),
    });
  });

  it("returns deprecated-profile doctor guidance for legacy Codex CLI ids", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.buildAuthDoctorHint?.({
        provider: "openai-codex",
        profileId: "openai-codex:codex-cli",
        config: undefined,
        store: { version: 1, profiles: {} },
      }),
    ).toBe(
      "Deprecated profile. Run `coreblow models auth login --provider openai-codex` or `coreblow configure`.",
    );
  });

  it("offers backup API key auth for Codex setup flows", () => {
    const provider = buildOpenAICodexProviderPlugin();
    const authIds = provider.auth.map((method) => method.id);
    const apiKey = provider.auth.find((method) => method.id === "api-key");

    expect(authIds).toEqual(["oauth", "api-key"]);
    expect(apiKey?.label).toBe("OpenAI API Key Backup");
    expect(apiKey?.wizard?.choiceId).toBe("openai-codex-api-key");
  });

  it("exposes grouped model/auth picker labels for Codex auth methods", () => {
    const provider = buildOpenAICodexProviderPlugin();
    const oauth = provider.auth.find((method) => method.id === "oauth");
    const apiKey = provider.auth.find((method) => method.id === "api-key");

    expect(oauth?.wizard).toMatchObject({
      choiceLabel: "ChatGPT/Codex Browser Login",
      groupId: "openai",
      groupLabel: "OpenAI",
      groupHint: "ChatGPT/Codex sign-in or API key",
    });
    expect(apiKey?.wizard).toMatchObject({
      choiceLabel: "OpenAI API Key Backup",
      choiceHint: "Use an OpenAI API key when your Codex subscription is unavailable",
      groupId: "openai",
      groupLabel: "OpenAI",
      groupHint: "ChatGPT/Codex sign-in or API key",
    });
  });

  it("declares the legacy default OAuth profile repair", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(provider.oauthProfileIdRepairs).toEqual([
      {
        legacyProfileId: "openai-codex:default",
        promptLabel: "OpenAI Codex",
      },
    ]);
  });

  it("owns native reasoning output mode for Codex responses", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.resolveReasoningOutputMode?.({
        provider: "openai-codex",
        modelApi: "openai-codex-responses",
        modelId: "gpt-5.4",
      }),
    ).toBe("native");
  });

  it("resolves gpt-5.4 with native contextWindow plus default contextTokens cap", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.resolveDynamicModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4",
        modelRegistry: createCodexRegistry() as never,
      }),
    ).toMatchObject({
      id: "gpt-5.4",
      contextWindow: 1_050_000,
      contextTokens: 272_000,
      maxTokens: 128_000,
      cost: { input: 2.5, output: 15, cacheRead: 0.25, cacheWrite: 0 },
    });
  });

  it("resolves gpt-5.4-pro with pro pricing and codex-sized limits", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.resolveDynamicModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4-pro",
        modelRegistry: createCodexRegistry() as never,
      }),
    ).toMatchObject({
      id: "gpt-5.4-pro",
      contextWindow: 1_050_000,
      contextTokens: 272_000,
      maxTokens: 128_000,
      cost: { input: 30, output: 180, cacheRead: 0, cacheWrite: 0 },
    });
  });

  it("resolves gpt-5.4-mini through the Codex OAuth route", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.resolveDynamicModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4-mini",
        modelRegistry: createCodexRegistry() as never,
      }),
    ).toMatchObject({
      id: "gpt-5.4-mini",
      contextWindow: 400_000,
      contextTokens: 272_000,
      maxTokens: 128_000,
      cost: { input: 0.75, output: 4.5, cacheRead: 0.075, cacheWrite: 0 },
    });
  });

  it("resolves the legacy gpt-5.4-codex alias to canonical gpt-5.4", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.resolveDynamicModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4-codex",
        modelRegistry: createCodexRegistry() as never,
      }),
    ).toMatchObject({ id: "gpt-5.4", name: "gpt-5.4" });
  });

  it("canonicalizes legacy gpt-5.4-codex models during resolved-model normalization", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.normalizeResolvedModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4-codex",
        model: {
          id: "gpt-5.4-codex",
          name: "gpt-5.4-codex",
          provider: "openai-codex",
          api: "openai-codex-responses",
          baseUrl: "https://chatgpt.com/backend-api/codex",
          reasoning: true,
          input: ["text", "image"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 1_050_000,
          maxTokens: 128_000,
        } as never,
      }),
    ).toMatchObject({
      id: "gpt-5.4",
      name: "gpt-5.4",
    });
  });

  it("defaults missing codex api metadata to openai-codex-responses", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.normalizeResolvedModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4",
        model: {
          id: "gpt-5.4",
          name: "gpt-5.4",
          provider: "openai-codex",
          baseUrl: "https://chatgpt.com/backend-api/codex",
          reasoning: true,
          input: ["text", "image"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 1_050_000,
          maxTokens: 128_000,
        } as never,
      }),
    ).toMatchObject({
      api: "openai-codex-responses",
      baseUrl: "https://chatgpt.com/backend-api/codex",
    });
  });

  it("normalizes legacy completions metadata to the codex transport", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.normalizeResolvedModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4",
        model: {
          id: "gpt-5.4",
          name: "gpt-5.4",
          provider: "openai-codex",
          api: "openai-completions",
          baseUrl: "https://api.openai.com/v1",
          reasoning: true,
          input: ["text", "image"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 1_050_000,
          maxTokens: 128_000,
        } as never,
      }),
    ).toMatchObject({
      api: "openai-codex-responses",
      baseUrl: "https://chatgpt.com/backend-api/codex",
    });
  });

  it("normalizes legacy GitHub Copilot Codex metadata to the codex transport", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.normalizeResolvedModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4",
        model: {
          id: "gpt-5.4",
          name: "gpt-5.4",
          provider: "openai-codex",
          api: "openai-completions",
          baseUrl: "https://api.githubcopilot.com/v1",
          reasoning: true,
          input: ["text", "image"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 1_050_000,
          maxTokens: 128_000,
        } as never,
      }),
    ).toMatchObject({
      api: "openai-codex-responses",
      baseUrl: "https://chatgpt.com/backend-api/codex",
    });
  });

  it("leaves custom proxy completions transport metadata unchanged", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.normalizeResolvedModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4",
        model: {
          id: "gpt-5.4",
          name: "gpt-5.4",
          provider: "openai-codex",
          api: "openai-completions",
          baseUrl: "https://proxy.example.com/v1",
          reasoning: true,
          input: ["text", "image"],
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 1_050_000,
          maxTokens: 128_000,
        } as never,
      }),
    ).toMatchObject({
      api: "openai-completions",
      baseUrl: "https://proxy.example.com/v1",
    });
  });

  it("normalizes transport metadata for stale /backend-api/v1 codex routes", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.normalizeTransport?.({
        provider: "openai-codex",
        api: "openai-codex-responses",
        baseUrl: "https://chatgpt.com/backend-api/v1",
      }),
    ).toMatchObject({
      api: "openai-codex-responses",
      baseUrl: "https://chatgpt.com/backend-api/codex",
    });
  });

  it("normalizes transport metadata for legacy completions codex routes", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.normalizeTransport?.({
        provider: "openai-codex",
        api: "openai-completions",
        baseUrl: "https://chatgpt.com/backend-api/codex",
      }),
    ).toMatchObject({
      api: "openai-codex-responses",
      baseUrl: "https://chatgpt.com/backend-api/codex",
    });
  });

  it("normalizes transport metadata for legacy GitHub Copilot Codex routes", () => {
    const provider = buildOpenAICodexProviderPlugin();

    expect(
      provider.normalizeTransport?.({
        provider: "openai-codex",
        api: "openai-completions",
        baseUrl: "https://api.githubcopilot.com/v1",
      }),
    ).toMatchObject({
      api: "openai-codex-responses",
      baseUrl: "https://chatgpt.com/backend-api/codex",
    });
  });

  it("normalizes legacy Codex transport metadata while preserving custom proxies", () => {
    const provider = buildOpenAICodexProviderPlugin();
    const baseModel = {
      id: "gpt-5.4-codex",
      name: "gpt-5.4-codex",
      provider: "openai-codex",
      api: "openai-completions",
      baseUrl: "https://chatgpt.com/backend-api/v1",
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1_050_000,
      maxTokens: 128_000,
    };

    expect(
      provider.normalizeResolvedModel?.({
        provider: "openai-codex",
        modelId: baseModel.id,
        model: baseModel as never,
      }),
    ).toMatchObject({
      id: "gpt-5.4",
      name: "gpt-5.4",
      api: "openai-codex-responses",
      baseUrl: "https://chatgpt.com/backend-api/codex",
    });
    expect(
      provider.normalizeResolvedModel?.({
        provider: "openai-codex",
        modelId: "gpt-5.4",
        model: {
          ...baseModel,
          id: "gpt-5.4",
          name: "gpt-5.4",
          baseUrl: "https://proxy.example.com/v1",
        } as never,
      }),
    ).toMatchObject({
      api: "openai-completions",
      baseUrl: "https://proxy.example.com/v1",
    });
  });
});
