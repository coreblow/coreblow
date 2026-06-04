import { describe, expect, it } from "vitest";
import { resolveProviderPluginChoice } from "../../src/plugins/provider-wizard.js";
import { capturePluginRegistration } from "../../src/plugins/captured-registration.js";
import plugin from "./index.js";
import { QWEN_36_PLUS_MODEL_ID, QWEN_BASE_URL } from "./api.js";

async function runCatalog(provider: ReturnType<typeof capturePluginRegistration>["providers"][0]) {
  return await provider.catalog?.run({
    config: {},
    env: {},
    resolveProviderApiKey: () => ({ apiKey: "test-key" }),
    resolveProviderAuth: () => ({
      apiKey: "test-key",
      mode: "api_key",
      source: "env",
    }),
  } as never);
}

describe("qwen provider plugin", () => {
  it("registers provider, media, and video surfaces", () => {
    const captured = capturePluginRegistration(plugin);

    expect(captured.providers.map((provider) => provider.id)).toEqual(["qwen"]);
    expect(captured.mediaUnderstandingProviders.map((provider) => provider.id)).toEqual(["qwen"]);
    expect(captured.videoGenerationProviders.map((provider) => provider.id)).toEqual(["qwen"]);

    const provider = captured.providers[0];
    expect(provider?.aliases).toEqual(["qwencloud", "modelstudio", "dashscope"]);
    expect(provider?.envVars).toEqual(["QWEN_API_KEY", "MODELSTUDIO_API_KEY", "DASHSCOPE_API_KEY"]);
    expect(provider?.auth.map((method) => method.id)).toEqual([
      "standard-api-key-cn",
      "standard-api-key",
      "api-key-cn",
      "api-key",
    ]);
    const resolved = resolveProviderPluginChoice({
      providers: captured.providers,
      choice: "qwen-api-key",
    });
    expect(resolved?.provider.id).toBe("qwen");
    expect(resolved?.method.id).toBe("api-key");
  });

  it("builds the auth-backed Qwen provider catalog", async () => {
    const captured = capturePluginRegistration(plugin);
    const provider = captured.providers[0];
    if (!provider) {
      throw new Error("expected Qwen provider");
    }
    const catalog = await runCatalog(provider);

    expect(catalog && "provider" in catalog).toBe(true);
    if (!catalog || !("provider" in catalog)) {
      throw new Error("expected single-provider catalog");
    }
    expect(catalog.provider.apiKey).toBe("test-key");
    expect(catalog.provider.baseUrl).toBe(QWEN_BASE_URL);
    expect(catalog.provider.models?.map((model) => model.id)).not.toContain(QWEN_36_PLUS_MODEL_ID);
  });

  it("keeps qwen3.6-plus out of Coding Plan normalized catalogs", () => {
    const captured = capturePluginRegistration(plugin);
    const provider = captured.providers[0];
    if (!provider) {
      throw new Error("expected Qwen provider");
    }

    const normalized = provider.normalizeConfig?.({
      provider: "qwen",
      providerConfig: {
        baseUrl: QWEN_BASE_URL,
        api: "openai-completions",
        models: [{ id: "qwen3.5-plus" }, { id: QWEN_36_PLUS_MODEL_ID }],
      },
    } as never);

    expect(normalized?.models?.map((model) => model.id)).toEqual(["qwen3.5-plus"]);
    expect(provider.suppressBuiltInModel).toBeUndefined();
  });
});
