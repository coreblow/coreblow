/**
 * extensions/nvidia/provider-catalog.test.ts
 * CoreBlow — Nvidia Extension Provider Catalog Tests
 */
import { describe, expect, it } from "vitest";
import { buildNvidiaProvider, NVIDIA_DEFAULT_MODEL_ID } from "./provider-catalog.js";

describe("buildNvidiaProvider", () => {
  it("returns the OpenAI-compatible NVIDIA provider catalog", () => {
    const p = buildNvidiaProvider();
    expect(p.baseUrl).toBe("https://integrate.api.nvidia.com/v1");
    expect(p.api).toBe("openai-completions");
    expect(p.models?.map((model) => model.id)).toEqual([
      NVIDIA_DEFAULT_MODEL_ID,
      "moonshotai/kimi-k2.5",
      "minimaxai/minimax-m2.5",
      "z-ai/glm5",
    ]);
  });
});
