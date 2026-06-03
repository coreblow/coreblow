import type { StreamFn } from "@mariozechner/pi-agent-core";
import { resolveTranscriptPolicy } from "../../src/agents/transcript-policy.js";
import { registerSingleProviderPlugin } from "../../src/test-utils/plugin-registration.js";
import { describe, expect, it } from "vitest";
import plugin from "./index.js";

function createGlm47Template() {
  return {
    id: "glm-4.7",
    name: "GLM-4.7",
    provider: "zai",
    api: "openai-completions",
    baseUrl: "https://api.z.ai/api/paas/v4",
    reasoning: true,
    input: ["text"],
    cost: { input: 0.6, output: 2.2, cacheRead: 0.11, cacheWrite: 0 },
    contextWindow: 204800,
    maxTokens: 131072,
  };
}

describe("zai provider plugin", () => {
  it("keeps OpenAI-compatible transcript validation for GLM models", () => {
    const provider = registerSingleProviderPlugin(plugin);
    const policy = resolveTranscriptPolicy({
      provider: provider.id,
      modelApi: "openai-completions",
      modelId: "glm-5",
    });

    expect(policy).toMatchObject({
      sanitizeToolCallIds: true,
      toolCallIdMode: "strict",
      applyGoogleTurnOrdering: true,
      validateGeminiTurns: true,
      validateAnthropicTurns: true,
      dropThinkingBlocks: false,
    });
  });

  it("resolves GLM-5 family dynamic models from the GLM-4.7 template", () => {
    const provider = registerSingleProviderPlugin(plugin);
    const template = createGlm47Template();

    const resolved = provider.resolveDynamicModel?.({
      provider: "zai",
      modelId: "glm-5-turbo",
      modelRegistry: {
        find: (_provider: string, modelId: string) => (modelId === "glm-4.7" ? template : null),
      },
    } as never);

    expect(resolved).toMatchObject({
      id: "glm-5-turbo",
      name: "glm-5-turbo",
      provider: "zai",
      api: "openai-completions",
      reasoning: true,
      input: ["text"],
    });
  });

  it("preserves an already-registered GLM-5 family model as-is", () => {
    const provider = registerSingleProviderPlugin(plugin);
    const registered = {
      id: "glm-5-turbo",
      name: "GLM-5 Turbo",
      provider: "zai",
      api: "openai-completions",
      baseUrl: "https://api.z.ai/api/paas/v4",
      reasoning: false,
      input: ["text"],
      cost: { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 123456,
      maxTokens: 54321,
    };
    const template = createGlm47Template();

    expect(
      provider.resolveDynamicModel?.({
        provider: "zai",
        modelId: "glm-5-turbo",
        modelRegistry: {
          find: (_provider: string, modelId: string) =>
            modelId === "glm-5-turbo" ? registered : modelId === "glm-4.7" ? template : null,
        },
      } as never),
    ).toEqual(registered);
  });

  it("defaults tool_stream extra params but preserves explicit values", () => {
    const provider = registerSingleProviderPlugin(plugin);

    expect(
      provider.prepareExtraParams?.({
        provider: "zai",
        modelId: "glm-4.7",
        extraParams: { endpoint: "global" },
      } as never),
    ).toEqual({
      endpoint: "global",
      tool_stream: true,
    });

    const explicit = { endpoint: "global", tool_stream: false };
    expect(
      provider.prepareExtraParams?.({
        provider: "zai",
        modelId: "glm-4.7",
        extraParams: explicit,
      } as never),
    ).toBe(explicit);
  });

  it("injects tool_stream by default and allows explicit disable", () => {
    const provider = registerSingleProviderPlugin(plugin);
    let capturedPayload: Record<string, unknown> | undefined;
    const baseStreamFn: StreamFn = (_model, _context, options) => {
      const payload: Record<string, unknown> = {};
      options?.onPayload?.(payload as never, {} as never);
      capturedPayload = payload;
      return {} as ReturnType<StreamFn>;
    };

    const enabled = provider.wrapStreamFn?.({
      provider: "zai",
      modelId: "glm-5",
      extraParams: {},
      streamFn: baseStreamFn,
    } as never);
    enabled?.({} as never, {} as never, {});
    expect(capturedPayload?.tool_stream).toBe(true);

    const disabled = provider.wrapStreamFn?.({
      provider: "zai",
      modelId: "glm-5",
      extraParams: { tool_stream: false },
      streamFn: baseStreamFn,
    } as never);
    disabled?.({} as never, {} as never, {});
    expect(capturedPayload).not.toHaveProperty("tool_stream");
  });
});
