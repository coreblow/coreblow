import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  discoverMantleModels,
  generateBearerTokenFromIam,
  getCachedIamToken,
  MANTLE_IAM_TOKEN_MARKER,
  mergeImplicitMantleProvider,
  resetIamTokenCacheForTest,
  resetMantleDiscoveryCacheForTest,
  resolveImplicitMantleProvider,
  resolveMantleBearerToken,
  resolveMantleRuntimeBearerToken,
} from "./api.js";

function createTokenProviderFactory(tokenProvider: () => Promise<string>) {
  return vi.fn(() => tokenProvider);
}

describe("bedrock mantle discovery", () => {
  beforeEach(() => {
    resetMantleDiscoveryCacheForTest();
    resetIamTokenCacheForTest();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetMantleDiscoveryCacheForTest();
    resetIamTokenCacheForTest();
  });

  it("resolves bearer token from AWS_BEARER_TOKEN_BEDROCK", () => {
    expect(
      resolveMantleBearerToken({
        AWS_BEARER_TOKEN_BEDROCK: "  bedrock-api-key-abc123  ",
      } as NodeJS.ProcessEnv),
    ).toBe("bedrock-api-key-abc123");
    expect(resolveMantleBearerToken({} as NodeJS.ProcessEnv)).toBeUndefined();
  });

  it("generates and caches IAM tokens per region", async () => {
    const tokenProvider = vi.fn(async () => "bedrock-api-key-cached");
    const tokenProviderFactory = createTokenProviderFactory(tokenProvider);
    let now = Date.now();

    const first = await generateBearerTokenFromIam({
      region: "us-east-1",
      now: () => now,
      tokenProviderFactory,
    });
    now += 1800_000;
    const second = await generateBearerTokenFromIam({
      region: "us-east-1",
      now: () => now,
      tokenProviderFactory,
    });

    expect(first).toBe("bedrock-api-key-cached");
    expect(second).toBe(first);
    expect(tokenProviderFactory).toHaveBeenCalledWith({
      region: "us-east-1",
      expiresInSeconds: 7200,
    });
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(getCachedIamToken("us-east-1")).toBe("bedrock-api-key-cached");
  });

  it("resolves runtime IAM marker into a generated bearer token", async () => {
    const tokenProvider = vi.fn(async () => "bedrock-api-key-runtime");
    const tokenProviderFactory = createTokenProviderFactory(tokenProvider);

    await expect(
      resolveMantleRuntimeBearerToken({
        apiKey: MANTLE_IAM_TOKEN_MARKER,
        env: { AWS_REGION: "us-west-2" } as NodeJS.ProcessEnv,
        now: () => 2000,
        tokenProviderFactory,
      }),
    ).resolves.toEqual({
      apiKey: "bedrock-api-key-runtime",
      expiresAt: 7202_000,
    });
  });

  it("discovers OpenAI-format models sorted by id with reasoning inference", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: "openai.gpt-oss-120b" },
          { id: "anthropic.claude-sonnet-4-6" },
          { id: "mistral.devstral-2-123b" },
        ],
      }),
    });

    const models = await discoverMantleModels({
      region: "us-east-1",
      bearerToken: "test-token",
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    expect(fetchMock).toHaveBeenCalledWith("https://bedrock-mantle.us-east-1.api.aws/v1/models", {
      method: "GET",
      headers: {
        Authorization: "Bearer test-token",
        Accept: "application/json",
      },
    });
    expect(models.map((model) => model.id)).toEqual([
      "anthropic.claude-sonnet-4-6",
      "mistral.devstral-2-123b",
      "openai.gpt-oss-120b",
    ]);
    expect(models[2]?.reasoning).toBe(true);
  });

  it("resolves implicit provider from explicit token and appends Mantle Claude model", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [{ id: "openai.gpt-oss-120b" }] }),
    });

    const provider = await resolveImplicitMantleProvider({
      env: {
        AWS_BEARER_TOKEN_BEDROCK: "test-token",
        AWS_REGION: "us-east-1",
      } as NodeJS.ProcessEnv,
      fetchFn: fetchMock as unknown as typeof fetch,
    });

    expect(provider).toMatchObject({
      baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
      api: "openai-completions",
      apiKey: "env:AWS_BEARER_TOKEN_BEDROCK",
    });
    expect(provider?.models?.map((model) => model.id)).toEqual([
      "openai.gpt-oss-120b",
      "anthropic.claude-opus-4-7",
    ]);
  });

  it("skips discovery when plugin config disables it", async () => {
    const tokenProviderFactory = vi.fn(() => {
      throw new Error("disabled discovery should not generate a token");
    });

    await expect(
      resolveImplicitMantleProvider({
        env: { AWS_REGION: "us-east-1" } as NodeJS.ProcessEnv,
        pluginConfig: { discovery: { enabled: false } },
        tokenProviderFactory,
      }),
    ).resolves.toBeNull();
    expect(tokenProviderFactory).not.toHaveBeenCalled();
  });

  it("merges implicit provider with explicit overrides", () => {
    const merged = mergeImplicitMantleProvider({
      implicit: {
        baseUrl: "https://bedrock-mantle.us-east-1.api.aws/v1",
        api: "openai-completions",
        models: [
          {
            id: "implicit",
            name: "Implicit",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 1,
            maxTokens: 1,
          },
        ],
      },
      existing: {
        baseUrl: "https://proxy.example.test/v1",
        headers: { "x-test": "1" },
        models: [],
      },
    });

    expect(merged.baseUrl).toBe("https://proxy.example.test/v1");
    expect(merged.headers).toEqual({ "x-test": "1" });
    expect(merged.models?.map((model) => model.id)).toEqual(["implicit"]);
  });
});
