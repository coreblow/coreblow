import type { BedrockClient } from "@aws-sdk/client-bedrock";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();
// CB discoverBedrockModels requires region + clientFactory(region)
function clientFactory(_region: string) {
  return { send: sendMock } as unknown as BedrockClient;
}

const baseActiveAnthropicSummary = {
  modelId: "anthropic.claude-3-7-sonnet-20250219-v1:0",
  modelName: "Claude 3.7 Sonnet",
  providerName: "anthropic",
  inputModalities: ["TEXT"],
  outputModalities: ["TEXT"],
  responseStreamingSupported: true,
  modelLifecycle: { status: "ACTIVE" },
};

async function loadDiscovery() {
  const mod = await import("../plugin-sdk/amazon-bedrock.js");
  mod.resetBedrockDiscoveryCacheForTest();
  return mod;
}

function mockSingleActiveSummary(overrides: Partial<typeof baseActiveAnthropicSummary> = {}): void {
  sendMock.mockResolvedValueOnce({
    modelSummaries: [{ ...baseActiveAnthropicSummary, ...overrides }],
  });
}

describe("bedrock discovery", () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  it("filters to active streaming text models only", async () => {
    const { discoverBedrockModels } = await loadDiscovery();

    sendMock.mockResolvedValueOnce({
      modelSummaries: [
        {
          modelId: "anthropic.claude-3-7-sonnet-20250219-v1:0",
          modelName: "Claude 3.7 Sonnet",
          providerName: "anthropic",
          inputModalities: ["TEXT", "IMAGE"],
          outputModalities: ["TEXT"],
          responseStreamingSupported: true,
          modelLifecycle: { status: "ACTIVE" },
        },
        {
          modelId: "anthropic.claude-3-haiku-20240307-v1:0",
          modelName: "Claude 3 Haiku",
          providerName: "anthropic",
          inputModalities: ["TEXT"],
          outputModalities: ["TEXT"],
          responseStreamingSupported: false, // excluded — no streaming
          modelLifecycle: { status: "ACTIVE" },
        },
        {
          modelId: "amazon.titan-text-g1-express-v1:0",
          modelName: "Titan Text G1 Express",
          providerName: "amazon",
          inputModalities: ["TEXT"],
          outputModalities: ["TEXT"],
          responseStreamingSupported: true,
          modelLifecycle: { status: "LEGACY" }, // excluded — not active
        },
      ],
    });

    const models = await discoverBedrockModels({ region: "us-east-1", clientFactory });
    // Only Claude 3.7 Sonnet (active + streaming)
    expect(models).toHaveLength(1);
    expect(models[0].id).toContain("claude-3-7-sonnet");
  });

  it("returns empty array when no active streaming models found", async () => {
    const { discoverBedrockModels } = await loadDiscovery();

    sendMock.mockResolvedValueOnce({
      modelSummaries: [
        { ...baseActiveAnthropicSummary, responseStreamingSupported: false },
      ],
    });

    const models = await discoverBedrockModels({ region: "us-east-1", clientFactory });
    expect(models).toEqual([]);
  });

  it("handles empty modelSummaries gracefully", async () => {
    const { discoverBedrockModels } = await loadDiscovery();
    sendMock.mockResolvedValueOnce({ modelSummaries: [] });

    const models = await discoverBedrockModels({ region: "us-east-1", clientFactory });
    expect(models).toEqual([]);
  });

  it("caches results on second call with same config", async () => {
    const { discoverBedrockModels } = await loadDiscovery();
    mockSingleActiveSummary();

    const first = await discoverBedrockModels({
      region: "us-east-1",
      clientFactory,
      config: { refreshInterval: 3600 },
    });
    const second = await discoverBedrockModels({
      region: "us-east-1",
      clientFactory,
      config: { refreshInterval: 3600 },
    });

    // Only one API call (cache hit on second)
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it("returns all active streaming models", async () => {
    const { discoverBedrockModels } = await loadDiscovery();
    sendMock.mockResolvedValueOnce({
      modelSummaries: [
        { ...baseActiveAnthropicSummary, inputModalities: ["TEXT"] },
        {
          ...baseActiveAnthropicSummary,
          modelId: "anthropic.claude-3-opus-20240229-v1:0",
          modelName: "Claude 3 Opus",
          inputModalities: ["TEXT", "IMAGE"],
        },
      ],
    });

    const models = await discoverBedrockModels({ region: "us-east-1", clientFactory });
    expect(models).toHaveLength(2);
  });
});
