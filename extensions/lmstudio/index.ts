import {
  definePluginEntry,
  type CoreBlowConfig,
  type CoreBlowPluginApi,
  type ProviderRuntimeModel,
} from "coreblow/plugin-sdk/plugin-entry";
import { CUSTOM_LOCAL_AUTH_MARKER } from "coreblow/plugin-sdk/provider-auth";
import { lmstudioMemoryEmbeddingProviderAdapter } from "./memory-embedding-adapter.js";
import {
  LMSTUDIO_DEFAULT_API_KEY_ENV_VAR,
  LMSTUDIO_PROVIDER_ID,
  LMSTUDIO_PROVIDER_LABEL,
} from "./src/defaults.js";
import {
  normalizeLmstudioConfiguredCatalogEntries,
  normalizeLmstudioProviderConfig,
} from "./src/models.js";
import { shouldUseLmstudioSyntheticAuth } from "./src/provider-auth.js";
import { wrapLmstudioInferencePreload } from "./src/stream.js";

const cachedDynamicModels = new Map<string, ProviderRuntimeModel[]>();

function resolveLmstudioAugmentedCatalogEntries(config: CoreBlowConfig | undefined) {
  if (!config) {
    return [];
  }
  return normalizeLmstudioConfiguredCatalogEntries(
    config.models?.providers?.[LMSTUDIO_PROVIDER_ID]?.models,
  ).map((entry) => ({
    provider: LMSTUDIO_PROVIDER_ID,
    id: entry.id,
    name: entry.name ?? entry.id,
    compat: { ...entry.compat, supportsUsageInStreaming: true },
    contextWindow: entry.contextWindow,
    reasoning: entry.reasoning,
    input: entry.input,
  }));
}

async function loadProviderApi() {
  return await import("./api.js");
}

export default definePluginEntry({
  id: LMSTUDIO_PROVIDER_ID,
  name: "LM Studio Provider",
  description: "Bundled LM Studio provider plugin",
  register(api: CoreBlowPluginApi) {
    api.registerMemoryEmbeddingProvider(lmstudioMemoryEmbeddingProviderAdapter);
    api.registerProvider({
      id: LMSTUDIO_PROVIDER_ID,
      label: LMSTUDIO_PROVIDER_LABEL,
      docsPath: "/providers/lmstudio",
      envVars: [LMSTUDIO_DEFAULT_API_KEY_ENV_VAR],
      auth: [
        {
          id: "custom",
          label: LMSTUDIO_PROVIDER_LABEL,
          hint: "Local/self-hosted LM Studio server",
          kind: "custom",
          run: async (ctx) => {
            const providerApi = await loadProviderApi();
            return await providerApi.promptAndConfigureLmstudioInteractive({
              config: ctx.config,
              prompter: ctx.prompter,
            });
          },
          runNonInteractive: async (ctx) => {
            const providerApi = await loadProviderApi();
            return await providerApi.configureLmstudioNonInteractive(ctx);
          },
        },
      ],
      catalog: {
        order: "late",
        run: async (ctx) => {
          const providerApi = await loadProviderApi();
          return await providerApi.discoverLmstudioProvider(ctx);
        },
      },
      resolveSyntheticAuth: ({ providerConfig }) => {
        if (!shouldUseLmstudioSyntheticAuth(providerConfig)) {
          return undefined;
        }
        return {
          apiKey: CUSTOM_LOCAL_AUTH_MARKER,
          source: "models.providers.lmstudio (synthetic local key)",
          mode: "api-key",
        };
      },
      normalizeConfig: ({ providerConfig }) => normalizeLmstudioProviderConfig(providerConfig),
      prepareDynamicModel: async (ctx) => {
        const providerApi = await loadProviderApi();
        cachedDynamicModels.set(
          ctx.providerConfig?.baseUrl ?? "",
          await providerApi.prepareLmstudioDynamicModels(ctx),
        );
      },
      resolveDynamicModel: (ctx) =>
        cachedDynamicModels
          .get(ctx.providerConfig?.baseUrl ?? "")
          ?.find((model) => model.id === ctx.modelId),
      augmentModelCatalog: ({ config }) => resolveLmstudioAugmentedCatalogEntries(config),
      wrapStreamFn: wrapLmstudioInferencePreload,
      createEmbeddingProvider: async (ctx) => {
        const providerApi = await loadProviderApi();
        const { provider, client } = await providerApi.createLmstudioEmbeddingProvider({
          config: ctx.config,
          agentDir: ctx.agentDir,
          model: ctx.model,
          remote: ctx.remote
            ? {
                baseUrl: ctx.remote.baseUrl,
                apiKey: ctx.remote.apiKey as never,
                headers: ctx.remote.headers,
              }
            : undefined,
          outputDimensionality: ctx.outputDimensionality,
        });
        return {
          id: provider.id,
          model: provider.model,
          maxInputTokens: provider.maxInputTokens,
          embedQuery: provider.embedQuery,
          embedBatch: provider.embedBatch,
          client,
        };
      },
      wizard: {
        setup: {
          choiceId: LMSTUDIO_PROVIDER_ID,
          choiceLabel: "LM Studio",
          choiceHint: "Local/self-hosted LM Studio server",
          groupId: LMSTUDIO_PROVIDER_ID,
          groupLabel: "LM Studio",
          groupHint: "Self-hosted open-weight models",
          methodId: "custom",
        },
        modelPicker: {
          label: "LM Studio (custom)",
          hint: "Detect models from LM Studio /api/v1/models",
          methodId: "custom",
        },
      },
    });
  },
});
