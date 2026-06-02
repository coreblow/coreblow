import { describe, expect, it } from "vitest";
import {
  createProviderDynamicModelContext,
  runSingleProviderCatalog,
} from "./provider-model-test-helpers.js";
import { createStreamingErrorResponse } from "./streaming-error-response.js";

describe("test-support provider model helpers", () => {
  it("creates a dynamic model context with case-insensitive lookup", () => {
    const ctx = createProviderDynamicModelContext({
      provider: "demo",
      modelId: "MODEL-A",
      models: [{ provider: "demo", id: "model-a", name: "Model A" } as never],
    });

    expect(ctx.modelRegistry.find("demo", "MODEL-A")).toEqual({
      provider: "demo",
      id: "model-a",
      name: "Model A",
    });
  });

  it("runs a single-provider catalog with default auth", async () => {
    await expect(
      runSingleProviderCatalog({
        catalog: {
          run: async (ctx) => ({
            provider: {
              baseUrl: "https://example.test",
              apiKey: ctx.resolveProviderApiKey("demo").apiKey,
              models: [],
            },
          }),
        },
      }),
    ).resolves.toEqual({
      baseUrl: "https://example.test",
      apiKey: "x",
      models: [],
    });
  });

  it("creates a streaming error response with readable chunks", async () => {
    const { response, getReadCount } = createStreamingErrorResponse({
      status: 429,
      chunkCount: 2,
      chunkSize: 3,
      byte: 65,
    });

    expect(response.status).toBe(429);
    expect(await response.text()).toBe("AAAAAA");
    expect(getReadCount()).toBe(2);
  });
});
