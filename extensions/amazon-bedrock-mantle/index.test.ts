import { describe, expect, it, vi } from "vitest";
import { registerSingleProviderPlugin } from "../../src/test-utils/plugin-registration.js";
import bedrockMantlePlugin from "./index.js";

describe("amazon-bedrock-mantle provider plugin", () => {
  it("registers provider metadata and runtime hooks", () => {
    const provider = registerSingleProviderPlugin(bedrockMantlePlugin);

    expect(provider.id).toBe("amazon-bedrock-mantle");
    expect(provider.label).toBe("Amazon Bedrock Mantle (OpenAI-compatible)");
    expect(provider.docsPath).toBe("/providers/bedrock-mantle");
    expect(provider.auth).toEqual([]);
    expect(provider.resolveConfigApiKey).toBeTypeOf("function");
    expect(provider.prepareRuntimeAuth).toBeTypeOf("function");
    expect(provider.createStreamFn).toBeTypeOf("function");
  });

  it("uses live plugin config to disable catalog discovery", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("unexpected fetch"));
    const provider = registerSingleProviderPlugin(bedrockMantlePlugin);

    const result = await provider.catalog?.run({
      config: {
        plugins: {
          entries: {
            "amazon-bedrock-mantle": {
              config: {
                discovery: { enabled: false },
              },
            },
          },
        },
      },
      env: {
        AWS_BEARER_TOKEN_BEDROCK: "test-token",
        AWS_REGION: "us-east-1",
      } as NodeJS.ProcessEnv,
    } as never);

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("provides a custom stream only for Mantle Anthropic models", () => {
    const provider = registerSingleProviderPlugin(bedrockMantlePlugin);

    expect(
      typeof provider.createStreamFn?.({
        provider: "amazon-bedrock-mantle",
        modelId: "anthropic.claude-opus-4-7",
        model: {
          api: "anthropic-messages",
        },
      } as never),
    ).toBe("function");

    expect(
      provider.createStreamFn?.({
        provider: "amazon-bedrock-mantle",
        modelId: "openai.gpt-oss-120b",
        model: {
          api: "openai-completions",
        },
      } as never),
    ).toBeUndefined();
  });
});
