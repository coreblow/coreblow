import type { ProviderCatalogContext } from "coreblow/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import {
  OLLAMA_DEFAULT_API_KEY,
  OLLAMA_PROVIDER_ID,
  resolveOllamaDiscoveryResult,
  shouldUseSyntheticOllamaAuth,
  type OllamaPluginConfig,
} from "./src/discovery-shared.js";
import { buildOllamaProvider } from "./src/provider-models.js";

function resolveOllamaPluginConfig(ctx: ProviderCatalogContext): OllamaPluginConfig {
  const entries = (ctx.config.plugins?.entries ?? {}) as Record<
    string,
    { config?: OllamaPluginConfig }
  >;
  return entries.ollama?.config ?? {};
}

export const ollamaProviderDiscovery = {
  id: OLLAMA_PROVIDER_ID,
  label: "Ollama",
  docsPath: "/providers/ollama",
  envVars: ["OLLAMA_API_KEY"],
  auth: [],
  resolveSyntheticAuth: ({
    provider,
    providerConfig,
  }: {
    provider?: string;
    providerConfig?: ModelProviderConfig;
  }) =>
    shouldUseSyntheticOllamaAuth(providerConfig)
      ? {
          apiKey: OLLAMA_DEFAULT_API_KEY,
          source: `models.providers.${provider ?? OLLAMA_PROVIDER_ID} (synthetic local key)`,
          mode: "api-key" as const,
        }
      : undefined,
  catalog: {
    order: "late" as const,
    run: (ctx: ProviderCatalogContext) =>
      resolveOllamaDiscoveryResult({
        ctx,
        pluginConfig: resolveOllamaPluginConfig(ctx),
        buildProvider: buildOllamaProvider,
      }),
  },
};

export default ollamaProviderDiscovery;
