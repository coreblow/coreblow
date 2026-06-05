import { afterEach, describe, expect, it } from "vitest";
import { resolveRemoteEmbeddingBearerClient } from "./embeddings-remote-client.js";
import type { EmbeddingProviderOptions } from "./embeddings.js";

function options(remote?: EmbeddingProviderOptions["remote"]): EmbeddingProviderOptions {
  return {
    config: { models: { providers: {} } },
    provider: "openai",
    model: "text-embedding-3-small",
    fallback: "none",
    remote: {
      apiKey: "remote-key",
      ...remote,
    },
  } as EmbeddingProviderOptions;
}

describe("resolveRemoteEmbeddingBearerClient", () => {
  const previousVersion = process.env.COREBLOW_VERSION;

  afterEach(() => {
    process.env.COREBLOW_VERSION = previousVersion;
  });

  it("adds CoreBlow attribution headers for native OpenAI embedding requests", async () => {
    process.env.COREBLOW_VERSION = "9.8.7-test";

    const client = await resolveRemoteEmbeddingBearerClient({
      provider: "openai",
      options: options({
        headers: {
          originator: "custom",
          "User-Agent": "custom-agent",
        },
      }),
      defaultBaseUrl: "https://api.openai.com/v1",
    });

    expect(client.headers).toMatchObject({
      Authorization: "Bearer remote-key",
      originator: "coreblow",
      version: "9.8.7-test",
      "User-Agent": "coreblow/9.8.7-test",
    });
  });

  it("does not add attribution headers for custom OpenAI-compatible routes", async () => {
    const client = await resolveRemoteEmbeddingBearerClient({
      provider: "openai",
      options: options({ baseUrl: "https://embeddings.internal/v1" }),
      defaultBaseUrl: "https://api.openai.com/v1",
    });

    expect(client.baseUrl).toBe("https://embeddings.internal/v1");
    expect(client.headers).not.toHaveProperty("originator");
    expect(client.headers).not.toHaveProperty("User-Agent");
  });
});
