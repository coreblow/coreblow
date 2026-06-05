import { describe, expect, it, vi } from "vitest";
import type { MemoryEmbeddingProviderAdapter } from "coreblow/plugin-sdk/memory-core-host-engine-embeddings";
import { CUSTOM_LOCAL_AUTH_MARKER } from "coreblow/plugin-sdk/provider-auth";
import type { ProviderPlugin } from "coreblow/plugin-sdk/provider-model-shared";
import { createTestPluginApi } from "../../test/helpers/extensions/plugin-api.js";
import plugin from "./index.js";

function captureLmstudioPlugin() {
  const providers: ProviderPlugin[] = [];
  const memoryAdapters: MemoryEmbeddingProviderAdapter[] = [];
  plugin.register(
    createTestPluginApi({
      id: "lmstudio",
      name: "LM Studio",
      source: "test",
      config: {},
      runtime: {} as never,
      registerProvider(provider) {
        providers.push(provider);
      },
      registerMemoryEmbeddingProvider(adapter) {
        memoryAdapters.push(adapter);
      },
    }),
  );
  return { providers, memoryAdapters };
}

describe("lmstudio plugin", () => {
  it("registers provider and memory embedding surfaces", () => {
    const { providers, memoryAdapters } = captureLmstudioPlugin();

    expect(providers.map((provider) => provider.id)).toEqual(["lmstudio"]);
    expect(memoryAdapters.map((adapter) => adapter.id)).toEqual(["lmstudio"]);
    expect(providers[0]?.auth.map((method: { id: string }) => method.id)).toEqual(["custom"]);
    expect(providers[0]?.wizard?.setup).toMatchObject({
      choiceId: "lmstudio",
      methodId: "custom",
    });
  });

  it("synthesizes local auth for configured LM Studio providers", () => {
    const { providers } = captureLmstudioPlugin();
    const provider = providers[0];
    const synthetic = provider?.resolveSyntheticAuth?.({
      provider: "lmstudio",
      providerConfig: {
        baseUrl: "http://localhost:1234/v1",
        api: "openai-completions",
        models: [
          {
            id: "qwen3",
            name: "Qwen 3",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 4096,
            maxTokens: 1024,
          },
        ],
      },
    });

    expect(synthetic).toEqual({
      apiKey: CUSTOM_LOCAL_AUTH_MARKER,
      source: "models.providers.lmstudio (synthetic local key)",
      mode: "api-key",
    });
  });

  it("augments catalog from configured LM Studio models", async () => {
    const { providers } = captureLmstudioPlugin();
    const entries = await providers[0]?.augmentModelCatalog?.({
      env: {},
      entries: [],
      config: {
        models: {
          providers: {
            lmstudio: {
              baseUrl: "http://localhost:1234/v1",
              models: [
                {
                  id: "qwen3",
                  name: "Qwen 3",
                  contextWindow: 32768,
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  maxTokens: 4096,
                  reasoning: true,
                  input: ["text", "image"],
                },
              ],
            },
          },
        },
      },
    });

    expect(entries).toEqual([
      {
        provider: "lmstudio",
        id: "qwen3",
        name: "Qwen 3",
        compat: { supportsUsageInStreaming: true },
        contextWindow: 32768,
        reasoning: true,
        input: ["text", "image"],
      },
    ]);
  });

  it("wraps LM Studio streams with usage compat and async preload", async () => {
    const { providers } = captureLmstudioPlugin();
    const streamFn = vi.fn(() => ({ kind: "stream" }));
    const wrapped = providers[0]?.wrapStreamFn?.({
      provider: "lmstudio",
      modelId: "qwen3",
      model: {
        id: "lmstudio/qwen3",
        provider: "lmstudio",
        api: "openai-completions",
        baseUrl: "http://localhost:1234/v1",
        contextWindow: 4096,
      },
      streamFn: streamFn as never,
      config: {
        models: {
          providers: {
            lmstudio: {
              baseUrl: "http://localhost:1234/v1",
              params: { preload: false },
            },
          },
        },
      },
    } as never);

    expect(wrapped).toBeTypeOf("function");
    const result = wrapped?.(
      {
        id: "lmstudio/qwen3",
        provider: "lmstudio",
        api: "openai-completions",
      } as never,
      [] as never,
      {} as never,
    );
    expect(result).toEqual({ kind: "stream" });
    expect(streamFn).toHaveBeenCalledWith(
      expect.objectContaining({
        compat: { supportsUsageInStreaming: true },
      }),
      [],
      {},
    );
  });
});
