import { describe, expect, it } from "vitest";
import { registerSingleProviderPlugin } from "../../src/test-utils/plugin-registration.js";
import anthropicVertexPlugin from "./index.js";

describe("anthropic-vertex provider plugin", () => {
  it("registers provider metadata and synthetic ADC auth", () => {
    const provider = registerSingleProviderPlugin(anthropicVertexPlugin);

    expect(provider.id).toBe("anthropic-vertex");
    expect(provider.label).toBe("Anthropic Vertex");
    expect(provider.docsPath).toBe("/providers/models");
    expect(provider.auth).toEqual([]);
    expect(provider.capabilities).toMatchObject({
      providerFamily: "anthropic",
      dropThinkingBlockModelHints: ["claude"],
    });
    expect(provider.createStreamFn).toBeTypeOf("function");
  });

  it("resolves the ADC marker through provider hooks", async () => {
    const provider = registerSingleProviderPlugin(anthropicVertexPlugin);

    expect(
      provider.resolveConfigApiKey?.({
        provider: "anthropic-vertex",
        env: {
          ANTHROPIC_VERTEX_USE_GCP_METADATA: "true",
        } as NodeJS.ProcessEnv,
      } as never),
    ).toBe("gcp-vertex-credentials");

    const result = await provider.catalog?.run({
      config: {
        models: {
          providers: {
            "anthropic-vertex": {
              baseUrl: "https://europe-west4-aiplatform.googleapis.com",
              headers: { "x-test-header": "1" },
            },
          },
        },
      },
      env: {
        ANTHROPIC_VERTEX_USE_GCP_METADATA: "true",
        GOOGLE_CLOUD_LOCATION: "us-east5",
      } as NodeJS.ProcessEnv,
    } as never);

    if (!result || !("provider" in result)) {
      throw new Error("expected single provider catalog result");
    }
    expect(result.provider.api).toBe("anthropic-messages");
    expect(result.provider.apiKey).toBe("gcp-vertex-credentials");
    expect(result.provider.baseUrl).toBe("https://europe-west4-aiplatform.googleapis.com");
    expect(result.provider.headers).toEqual({ "x-test-header": "1" });
    expect(result.provider.models?.map((model) => model.id)).toEqual([
      "claude-opus-4-6",
      "claude-sonnet-4-6",
    ]);
  });
});
