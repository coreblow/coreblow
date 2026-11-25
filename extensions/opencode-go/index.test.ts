import { describe, expect, it } from "vitest";
import {
  createCapturedPluginRegistration,
  registerSingleProviderPlugin,
} from "../../test/helpers/extensions/plugin-registration.js";
import plugin from "./index.js";

describe("opencode-go provider plugin", () => {
  it("registers image media understanding through the OpenCode Go plugin", () => {
    const captured = createCapturedPluginRegistration();
    plugin.register(captured.api);

    const mediaProvider = captured.mediaUnderstandingProviders.find(
      (provider) => provider.id === "opencode-go",
    );
    if (!mediaProvider) {
      throw new Error("Expected opencode-go media provider");
    }
    expect(mediaProvider.capabilities).toEqual(["image"]);
    expect(mediaProvider.defaultModels).toEqual({ image: "kimi-k2.6" });
    expect(typeof mediaProvider.describeImage).toBe("function");
    expect(typeof mediaProvider.describeImages).toBe("function");
  });

  it("keeps OpenCode Go supplemental catalog coverage aligned", async () => {
    const provider = registerSingleProviderPlugin(plugin);
    const supplemental = await provider.augmentModelCatalog?.({ entries: [] } as never);
    expect(supplemental?.map((entry) => entry.id)).toEqual([
      "deepseek-v4-pro",
      "deepseek-v4-flash",
    ]);
    const dynamicModel = provider.resolveDynamicModel?.({ modelId: "deepseek-v4-pro" } as never);
    expect(dynamicModel?.id).toBe("deepseek-v4-pro");
    expect(dynamicModel?.baseUrl).toBe("https://opencode.ai/zen/go/v1");
  });

  it("strips unsupported Kimi reasoning payloads and disables DeepSeek V4 reasoning-off payloads", async () => {
    const provider = registerSingleProviderPlugin(plugin);
    const capturedPayloads: Record<string, unknown>[] = [];
    const baseStreamFn = (_model: unknown, _context: unknown, options: unknown) => {
      const payload = {
        model: "kimi-k2.6",
        reasoning_effort: "high",
        reasoning: { effort: "high" },
        reasoningEffort: "high",
      };
      (options as { onPayload?: (payload: Record<string, unknown>) => void })?.onPayload?.(payload);
      capturedPayloads.push(payload);
      return {} as never;
    };
    const kimiWrapped = provider.wrapStreamFn?.({
      streamFn: baseStreamFn as never,
      providerId: "opencode-go",
      modelId: "kimi-k2.6",
      thinkingLevel: "high",
    } as never);
    await kimiWrapped?.(
      { provider: "opencode-go", id: "kimi-k2.6", api: "openai-completions" } as never,
      {} as never,
      {},
    );
    expect(capturedPayloads[0]).toEqual({ model: "kimi-k2.6" });

    const deepseekPayloads: Record<string, unknown>[] = [];
    const deepseekBase = (_model: unknown, _context: unknown, options: unknown) => {
      const payload = { model: "deepseek-v4-flash", reasoning_effort: "off", reasoning: "off" };
      (options as { onPayload?: (payload: Record<string, unknown>) => void })?.onPayload?.(payload);
      deepseekPayloads.push(payload);
      return {} as never;
    };
    const deepseekWrapped = provider.wrapStreamFn?.({
      streamFn: deepseekBase as never,
      providerId: "opencode-go",
      modelId: "deepseek-v4-flash",
      thinkingLevel: "off",
    } as never);
    await deepseekWrapped?.(
      { provider: "opencode-go", id: "deepseek-v4-flash", api: "openai-completions" } as never,
      {} as never,
      {},
    );
    expect(deepseekPayloads[0]).toEqual({
      model: "deepseek-v4-flash",
      thinking: { type: "disabled" },
    });
  });
});
