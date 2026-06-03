import { describe, expect, it } from "vitest";
import { applyNvidiaConfig, applyNvidiaProviderConfig } from "./onboard.js";

describe("nvidia onboard", () => {
  it("adds NVIDIA provider with correct settings", () => {
    const cfg = applyNvidiaConfig({});
    const provider = cfg.models?.providers?.nvidia;
    if (!provider) {
      throw new Error("expected NVIDIA provider config");
    }
    expect(provider.baseUrl).toBe("https://integrate.api.nvidia.com/v1");
    expect(provider.api).toBe("openai-completions");
    expect(provider.models.map((model) => model.id)).toEqual([
      "nvidia/nemotron-3-super-120b-a12b",
      "moonshotai/kimi-k2.5",
      "minimaxai/minimax-m2.5",
      "z-ai/glm5",
    ]);
    expect(cfg.agents?.defaults?.model).toEqual({
      primary: "nvidia/nemotron-3-super-120b-a12b",
    });
    expect(cfg.agents?.defaults?.models?.["nvidia/nemotron-3-super-120b-a12b"]).toEqual({
      alias: "NVIDIA",
    });
  });

  it("merges NVIDIA models and keeps existing provider overrides", () => {
    const cfg = applyNvidiaProviderConfig({
      models: {
        providers: {
          nvidia: {
            api: "openai-completions",
            baseUrl: "https://integrate.api.nvidia.com/v1",
            models: [
              {
                id: "custom-model",
                name: "Custom",
                reasoning: false,
                input: ["text"],
                cost: {
                  input: 0,
                  output: 0,
                  cacheRead: 0,
                  cacheWrite: 0,
                },
                contextWindow: 1024,
                maxTokens: 512,
              },
            ],
          },
        },
      },
    });
    const provider = cfg.models?.providers?.nvidia;
    expect(provider?.models.map((model) => model.id)).toEqual([
      "nvidia/custom-model",
      "nvidia/nemotron-3-super-120b-a12b",
      "moonshotai/kimi-k2.5",
      "minimaxai/minimax-m2.5",
      "z-ai/glm5",
    ]);
  });
});
