import {
  definePluginEntry,
  type ProviderResolveDynamicModelContext,
  type ProviderRuntimeModel,
} from "coreblow/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "coreblow/plugin-sdk/provider-auth-api-key";
import { DEFAULT_CONTEXT_TOKENS } from "coreblow/plugin-sdk/provider-model-shared";
import {
  getOpenRouterModelCapabilities,
  loadOpenRouterModelCapabilities,
} from "coreblow/plugin-sdk/provider-stream";
import { applyXaiModelCompat } from "coreblow/plugin-sdk/xai";
import { buildOpenRouterImageGenerationProvider } from "./image-generation-provider.js";
import { openrouterMediaUnderstandingProvider } from "./media-understanding-provider.js";
import { applyOpenrouterConfig, OPENROUTER_DEFAULT_MODEL_REF } from "./onboard.js";
import { buildOpenrouterProvider, OPENROUTER_BASE_URL } from "./provider-catalog.js";
import { buildOpenRouterSpeechProvider } from "./speech-provider.js";
import { wrapOpenRouterProviderStream } from "./stream.js";
import {
  resolveOpenRouterThinkingProfile,
  supportsOpenRouterXHighThinking,
} from "./thinking-policy.js";
import { buildOpenRouterVideoGenerationProvider } from "./video-generation-provider.js";

const PROVIDER_ID = "openrouter";
const OPENROUTER_DEFAULT_MAX_TOKENS = 8192;
const OPENROUTER_CACHE_TTL_MODEL_PREFIXES = [
  "anthropic/",
  "moonshot/",
  "moonshotai/",
  "zai/",
] as const;

function buildDynamicOpenRouterModel(
  ctx: ProviderResolveDynamicModelContext,
): ProviderRuntimeModel {
  const capabilities = getOpenRouterModelCapabilities(ctx.modelId);
  return {
    id: ctx.modelId,
    name: capabilities?.name ?? ctx.modelId,
    api: "openai-completions",
    provider: PROVIDER_ID,
    baseUrl: OPENROUTER_BASE_URL,
    reasoning: capabilities?.reasoning ?? false,
    input: capabilities?.input ?? ["text"],
    cost: capabilities?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: capabilities?.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
    maxTokens: capabilities?.maxTokens ?? OPENROUTER_DEFAULT_MAX_TOKENS,
  };
}

function isOpenRouterCacheTtlModel(modelId: string): boolean {
  return OPENROUTER_CACHE_TTL_MODEL_PREFIXES.some((prefix) => modelId.startsWith(prefix));
}

function isXaiOpenRouterModel(modelId: string): boolean {
  return modelId.trim().toLowerCase().startsWith("x-ai/");
}

export default definePluginEntry({
  id: "openrouter",
  name: "OpenRouter Provider",
  description: "Bundled OpenRouter provider plugin",
  register(api) {
    api.registerProvider({
      id: PROVIDER_ID,
      label: "OpenRouter",
      docsPath: "/providers/models",
      envVars: ["OPENROUTER_API_KEY"],
      auth: [
        createProviderApiKeyAuthMethod({
          providerId: PROVIDER_ID,
          methodId: "api-key",
          label: "OpenRouter API key",
          hint: "API key",
          optionKey: "openrouterApiKey",
          flagName: "--openrouter-api-key",
          envVar: "OPENROUTER_API_KEY",
          promptMessage: "Enter OpenRouter API key",
          defaultModel: OPENROUTER_DEFAULT_MODEL_REF,
          expectedProviders: ["openrouter"],
          applyConfig: (cfg) => applyOpenrouterConfig(cfg),
          wizard: {
            choiceId: "openrouter-api-key",
            choiceLabel: "OpenRouter API key",
            groupId: "openrouter",
            groupLabel: "OpenRouter",
            groupHint: "API key",
          },
        }),
      ],
      catalog: {
        order: "simple",
        run: async (ctx) => {
          const apiKey = ctx.resolveProviderApiKey(PROVIDER_ID).apiKey;
          if (!apiKey) {
            return null;
          }
          return {
            provider: {
              ...buildOpenrouterProvider(),
              apiKey,
            },
          };
        },
      },
      resolveDynamicModel: (ctx) => buildDynamicOpenRouterModel(ctx),
      prepareDynamicModel: async (ctx) => {
        await loadOpenRouterModelCapabilities(ctx.modelId);
      },
      capabilities: {
        openAiCompatTurnValidation: false,
        geminiThoughtSignatureSanitization: true,
        geminiThoughtSignatureModelHints: ["gemini"],
      },
      normalizeResolvedModel: ({ modelId, model }) =>
        isXaiOpenRouterModel(modelId) ? applyXaiModelCompat(model) : undefined,
      isModernModelRef: () => true,
      supportsXHighThinking: ({ modelId }) => supportsOpenRouterXHighThinking(modelId),
      resolveDefaultThinkingLevel: ({ modelId }) =>
        resolveOpenRouterThinkingProfile(modelId)?.defaultLevel,
      wrapStreamFn: (ctx) => wrapOpenRouterProviderStream(ctx),
      isCacheTtlEligible: (ctx) => isOpenRouterCacheTtlModel(ctx.modelId),
    });
    api.registerMediaUnderstandingProvider(openrouterMediaUnderstandingProvider);
    api.registerSpeechProvider(buildOpenRouterSpeechProvider());
    api.registerImageGenerationProvider(buildOpenRouterImageGenerationProvider());
    api.registerVideoGenerationProvider(buildOpenRouterVideoGenerationProvider());
  },
});
