import type {
  ProviderAuthMethodNonInteractiveContext,
  ProviderAuthResult,
  ProviderCatalogContext,
  ProviderPrepareDynamicModelContext,
  ProviderRuntimeModel,
} from "coreblow/plugin-sdk/plugin-entry";
import { normalizeModelCompat } from "coreblow/plugin-sdk/provider-model-shared";
import {
  applyProviderDefaultModel,
  configureOpenAICompatibleSelfHostedProviderNonInteractive,
  promptAndConfigureOpenAICompatibleSelfHostedProviderAuth,
} from "coreblow/plugin-sdk/provider-setup";
import {
  LMSTUDIO_DEFAULT_API_KEY_ENV_VAR,
  LMSTUDIO_DEFAULT_EMBEDDING_MODEL,
  LMSTUDIO_DEFAULT_INFERENCE_BASE_URL,
  LMSTUDIO_DEFAULT_MODEL_ID,
  LMSTUDIO_MODEL_PLACEHOLDER,
  LMSTUDIO_PROVIDER_ID,
  LMSTUDIO_PROVIDER_LABEL,
} from "./defaults.js";
import { discoverLmstudioModels } from "./models.fetch.js";
import {
  normalizeLmstudioProviderConfig,
  resolveLmstudioInferenceBase,
  type LmstudioModelWire,
} from "./models.js";
import { resolveLmstudioRequestContext } from "./runtime.js";

export async function promptAndConfigureLmstudioInteractive(params: {
  config: Parameters<typeof promptAndConfigureOpenAICompatibleSelfHostedProviderAuth>[0]["cfg"];
  prompter: Parameters<typeof promptAndConfigureOpenAICompatibleSelfHostedProviderAuth>[0]["prompter"];
}): Promise<ProviderAuthResult> {
  return await promptAndConfigureOpenAICompatibleSelfHostedProviderAuth({
    cfg: params.config,
    prompter: params.prompter,
    providerId: LMSTUDIO_PROVIDER_ID,
    providerLabel: LMSTUDIO_PROVIDER_LABEL,
    defaultBaseUrl: LMSTUDIO_DEFAULT_INFERENCE_BASE_URL,
    defaultApiKeyEnvVar: LMSTUDIO_DEFAULT_API_KEY_ENV_VAR,
    modelPlaceholder: LMSTUDIO_MODEL_PLACEHOLDER,
  });
}

export async function configureLmstudioNonInteractive(
  ctx: ProviderAuthMethodNonInteractiveContext,
) {
  const configured = await configureOpenAICompatibleSelfHostedProviderNonInteractive({
    ctx,
    providerId: LMSTUDIO_PROVIDER_ID,
    providerLabel: LMSTUDIO_PROVIDER_LABEL,
    defaultBaseUrl: LMSTUDIO_DEFAULT_INFERENCE_BASE_URL,
    defaultApiKeyEnvVar: LMSTUDIO_DEFAULT_API_KEY_ENV_VAR,
    modelPlaceholder: LMSTUDIO_MODEL_PLACEHOLDER,
  });
  return configured ? applyProviderDefaultModel(configured, `${LMSTUDIO_PROVIDER_ID}/${LMSTUDIO_DEFAULT_MODEL_ID}`) : configured;
}

function buildLmstudioProviderConfig(params: {
  baseUrl?: string;
  apiKey?: string;
  models: Awaited<ReturnType<typeof discoverLmstudioModels>>;
}) {
  return normalizeLmstudioProviderConfig({
    api: "openai-completions",
    baseUrl: resolveLmstudioInferenceBase(params.baseUrl),
    ...(params.apiKey ? { apiKey: params.apiKey } : {}),
    models: params.models,
  });
}

export async function discoverLmstudioProvider(ctx: ProviderCatalogContext) {
  const explicit = ctx.config.models?.providers?.[LMSTUDIO_PROVIDER_ID];
  let apiKey: string | undefined;
  let headers: Record<string, string> | undefined;
  try {
    ({ apiKey, headers } = await resolveLmstudioRequestContext({
      config: ctx.config,
      agentDir: ctx.agentDir,
      env: ctx.env,
      providerHeaders: explicit?.headers,
    }));
  } catch (error) {
    if (!explicit && error instanceof Error && /LM Studio API key is required/iu.test(error.message)) {
      apiKey = undefined;
      headers = undefined;
    } else {
      throw error;
    }
  }
  if (!explicit && !apiKey && (ctx.env.VITEST || ctx.env.NODE_ENV === "test")) {
    return null;
  }
  const models = await discoverLmstudioModels({
    baseUrl: explicit?.baseUrl ?? LMSTUDIO_DEFAULT_INFERENCE_BASE_URL,
    apiKey,
    headers,
    quiet: !apiKey && !explicit,
  });
  if (!explicit && models.length === 0 && !apiKey) {
    return null;
  }
  return {
    provider: buildLmstudioProviderConfig({
      baseUrl: explicit?.baseUrl,
      apiKey: apiKey ?? undefined,
      models: models.length > 0 ? models : (explicit?.models ?? []),
    }),
  };
}

function modelDefinitionToRuntimeModel(params: {
  model: Awaited<ReturnType<typeof discoverLmstudioModels>>[number];
  baseUrl: string;
}): ProviderRuntimeModel {
  return normalizeModelCompat({
    ...params.model,
    provider: LMSTUDIO_PROVIDER_ID,
    api: "openai-completions",
    baseUrl: params.baseUrl,
  } as ProviderRuntimeModel) as ProviderRuntimeModel;
}

export async function prepareLmstudioDynamicModels(
  ctx: ProviderPrepareDynamicModelContext,
): Promise<ProviderRuntimeModel[]> {
  const providerConfig = ctx.providerConfig ?? ctx.config?.models?.providers?.[LMSTUDIO_PROVIDER_ID];
  const { apiKey, headers } = await resolveLmstudioRequestContext({
    config: ctx.config,
    agentDir: ctx.agentDir,
    providerHeaders: providerConfig?.headers,
  });
  const baseUrl = resolveLmstudioInferenceBase(providerConfig?.baseUrl);
  const models = await discoverLmstudioModels({
    baseUrl,
    apiKey,
    headers,
    quiet: false,
  });
  return models.map((model) => modelDefinitionToRuntimeModel({ model, baseUrl }));
}

export type { LmstudioModelWire };
export { LMSTUDIO_DEFAULT_EMBEDDING_MODEL };
