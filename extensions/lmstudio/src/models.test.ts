import { describe, expect, it, vi } from "vitest";
import {
  discoverLmstudioModels,
  ensureLmstudioModelLoaded,
  fetchLmstudioModels,
} from "./models.fetch.js";
import {
  mapLmstudioWireEntry,
  normalizeLmstudioProviderConfig,
  resolveLmstudioInferenceBase,
  resolveLmstudioReasoningCompat,
  resolveLmstudioServerBase,
} from "./models.js";

function jsonResponse(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("lmstudio models", () => {
  it("normalizes server and inference base URLs", () => {
    expect(resolveLmstudioServerBase("lmstudio.internal:1234/v1")).toBe(
      "http://lmstudio.internal:1234",
    );
    expect(resolveLmstudioServerBase("http://localhost:1234/api/v1")).toBe(
      "http://localhost:1234",
    );
    expect(resolveLmstudioInferenceBase("http://localhost:1234/api/v1")).toBe(
      "http://localhost:1234/v1",
    );
  });

  it("normalizes provider base URL and defaults private-network requests", () => {
    const normalized = normalizeLmstudioProviderConfig({
      baseUrl: "http://localhost:1234/api/v1",
      api: "openai-completions",
      models: [],
    });

    expect(normalized.baseUrl).toBe("http://localhost:1234/v1");
    expect((normalized as { request?: { allowPrivateNetwork?: boolean } }).request).toEqual({
      allowPrivateNetwork: true,
    });
  });

  it("maps LM Studio reasoning and loaded context metadata", () => {
    const compat = resolveLmstudioReasoningCompat({
      capabilities: {
        reasoning: {
          allowed_options: ["off", "on"],
        },
      },
    });
    expect(compat?.supportedReasoningEfforts).toContain("xhigh");
    expect(compat?.reasoningEffortMap?.off).toBe("none");

    const mapped = mapLmstudioWireEntry({
      type: "llm",
      key: "qwen3",
      display_name: "Qwen 3",
      format: "gguf",
      max_context_length: 131072,
      capabilities: {
        vision: true,
        trained_for_tool_use: true,
      },
      loaded_instances: [{ config: { context_length: 64000 } }],
    });

    expect(mapped).toMatchObject({
      id: "qwen3",
      displayName: "Qwen 3",
      vision: true,
      trainedForToolUse: true,
      loaded: true,
      input: ["text", "image"],
      contextWindow: 131072,
      contextTokens: 64000,
    });
  });

  it("fetches and discovers LM Studio model catalog entries", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        models: [
          {
            type: "llm",
            key: "qwen3",
            display_name: "Qwen 3",
            format: "mlx",
            capabilities: { vision: true },
          },
          { type: "embedding", key: "nomic" },
        ],
      }),
    ) as unknown as typeof fetch;

    const fetched = await fetchLmstudioModels({
      baseUrl: "http://localhost:1234/v1",
      apiKey: "secret",
      fetchImpl,
    });
    expect(fetched.reachable).toBe(true);
    expect(fetched.models).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:1234/api/v1/models",
      expect.objectContaining({
        headers: { Authorization: "Bearer secret" },
      }),
    );

    const models = await discoverLmstudioModels({
      baseUrl: "http://localhost:1234/v1",
      apiKey: "secret",
      quiet: true,
      fetchImpl,
    });
    expect(models).toEqual([
      expect.objectContaining({
        id: "qwen3",
        name: "Qwen 3 (MLX, vision)",
        input: ["text", "image"],
        compat: { supportsUsageInStreaming: true },
      }),
    ]);
  });

  it("loads a model only when current loaded context is too small", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          models: [
            {
              type: "llm",
              key: "qwen3",
              max_context_length: 8192,
              loaded_instances: [{ config: { context_length: 2048 } }],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ status: "loaded" })) as unknown as typeof fetch;

    await ensureLmstudioModelLoaded({
      baseUrl: "http://localhost:1234/v1",
      modelKey: "qwen3",
      requestedContextLength: 4096,
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      "http://localhost:1234/api/v1/models/load",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ model: "qwen3", context_length: 4096 }),
      }),
    );
  });
});
