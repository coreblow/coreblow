import type {
  ProviderAuthContext,
  ProviderResolveDynamicModelContext,
  ProviderRuntimeModel,
} from "coreblow/plugin-sdk/plugin-entry";
import {
  CODEX_CLI_PROFILE_ID,
  ensureAuthProfileStore,
  listProfilesForProvider,
  type OAuthCredential,
} from "coreblow/plugin-sdk/provider-auth";
import { buildOauthProviderAuthResult } from "coreblow/plugin-sdk/provider-auth";
import { createProviderApiKeyAuthMethod } from "coreblow/plugin-sdk/provider-auth-api-key";
import { loginOpenAICodexOAuth } from "coreblow/plugin-sdk/provider-auth-login";
import {
  DEFAULT_CONTEXT_TOKENS,
  normalizeModelCompat,
  normalizeProviderId,
  type ProviderPlugin,
} from "coreblow/plugin-sdk/provider-model-shared";
import { fetchCodexUsage } from "coreblow/plugin-sdk/provider-usage";
import { OPENAI_CODEX_DEFAULT_MODEL } from "./default-models.js";
import {
  isOpenAIApiBaseUrl,
  isOpenAICodexBaseUrl,
  OPENAI_CODEX_RESPONSES_BASE_URL,
} from "./base-url.js";
import {
  OPENAI_CODEX_API_KEY_BACKUP_HINT,
  OPENAI_CODEX_API_KEY_BACKUP_LABEL,
  OPENAI_CODEX_LOGIN_HINT,
  OPENAI_CODEX_LOGIN_LABEL,
  OPENAI_CODEX_WIZARD_GROUP,
} from "./auth-choice-copy.js";
import { resolveCodexAuthIdentity } from "./openai-codex-auth-identity.js";
import { buildOpenAICodexProvider } from "./openai-codex-catalog.js";
import {
  buildOpenAIResponsesProviderHooks,
  buildOpenAISyntheticCatalogEntry,
  buildOpenAIToolCompatProviderHooks,
  cloneFirstTemplateModel,
  findCatalogTemplate,
  matchesExactOrPrefix,
} from "./shared.js";

const PROVIDER_ID = "openai-codex";
const OPENAI_CODEX_BASE_URL = OPENAI_CODEX_RESPONSES_BASE_URL;
const OPENAI_CODEX_GPT_55_MODEL_ID = "gpt-5.5";
const OPENAI_CODEX_GPT_55_PRO_MODEL_ID = "gpt-5.5-pro";
const OPENAI_CODEX_GPT_54_MODEL_ID = "gpt-5.4";
const OPENAI_CODEX_GPT_54_LEGACY_MODEL_ID = "gpt-5.4-codex";
const OPENAI_CODEX_GPT_54_PRO_MODEL_ID = "gpt-5.4-pro";
const OPENAI_CODEX_GPT_54_MINI_MODEL_ID = "gpt-5.4-mini";
const OPENAI_CODEX_GPT_55_CODEX_CONTEXT_TOKENS = 400_000;
const OPENAI_CODEX_GPT_55_DEFAULT_RUNTIME_CONTEXT_TOKENS = 272_000;
const OPENAI_CODEX_GPT_55_PRO_CONTEXT_TOKENS = 1_000_000;
const OPENAI_CODEX_GPT_55_PRO_DEFAULT_CONTEXT_TOKENS = 272_000;
const OPENAI_CODEX_GPT_54_CONTEXT_TOKENS = 1_050_000;
const OPENAI_CODEX_GPT_54_DEFAULT_CONTEXT_TOKENS = 272_000;
const OPENAI_CODEX_GPT_54_MINI_CONTEXT_TOKENS = 400_000;
const OPENAI_CODEX_GPT_54_MAX_TOKENS = 128_000;
const OPENAI_CODEX_GPT_54_TEMPLATE_MODEL_IDS = ["gpt-5.3-codex", "gpt-5.2-codex"] as const;
const OPENAI_CODEX_GPT_54_CATALOG_TEMPLATE_MODEL_IDS = [
  ...OPENAI_CODEX_GPT_54_TEMPLATE_MODEL_IDS,
  OPENAI_CODEX_GPT_54_MODEL_ID,
] as const;
const OPENAI_CODEX_GPT_55_PRO_TEMPLATE_MODEL_IDS = [
  OPENAI_CODEX_GPT_54_MODEL_ID,
  OPENAI_CODEX_GPT_54_PRO_MODEL_ID,
  ...OPENAI_CODEX_GPT_54_TEMPLATE_MODEL_IDS,
] as const;
const OPENAI_CODEX_GPT_55_PRO_COST = {
  input: 30,
  output: 180,
  cacheRead: 0,
  cacheWrite: 0,
} as const;
const OPENAI_CODEX_GPT_54_COST = {
  input: 2.5,
  output: 15,
  cacheRead: 0.25,
  cacheWrite: 0,
} as const;
const OPENAI_CODEX_GPT_54_PRO_COST = {
  input: 30,
  output: 180,
  cacheRead: 0,
  cacheWrite: 0,
} as const;
const OPENAI_CODEX_GPT_54_MINI_COST = {
  input: 0.75,
  output: 4.5,
  cacheRead: 0.075,
  cacheWrite: 0,
} as const;
const OPENAI_CODEX_GPT_53_MODEL_ID = "gpt-5.3-codex";
const OPENAI_CODEX_GPT_53_SPARK_MODEL_ID = "gpt-5.3-codex-spark";
const OPENAI_CODEX_GPT_53_SPARK_CONTEXT_TOKENS = 128_000;
const OPENAI_CODEX_GPT_53_SPARK_MAX_TOKENS = 128_000;
const OPENAI_CODEX_TEMPLATE_MODEL_IDS = ["gpt-5.2-codex"] as const;
const OPENAI_CODEX_XHIGH_MODEL_IDS = [
  OPENAI_CODEX_GPT_55_MODEL_ID,
  OPENAI_CODEX_GPT_55_PRO_MODEL_ID,
  OPENAI_CODEX_GPT_54_MODEL_ID,
  OPENAI_CODEX_GPT_54_PRO_MODEL_ID,
  OPENAI_CODEX_GPT_54_MINI_MODEL_ID,
  OPENAI_CODEX_GPT_53_MODEL_ID,
  OPENAI_CODEX_GPT_53_SPARK_MODEL_ID,
  "gpt-5.2-codex",
  "gpt-5.1-codex",
] as const;
const OPENAI_CODEX_MODERN_MODEL_IDS = [
  OPENAI_CODEX_GPT_55_MODEL_ID,
  OPENAI_CODEX_GPT_55_PRO_MODEL_ID,
  OPENAI_CODEX_GPT_54_MODEL_ID,
  OPENAI_CODEX_GPT_54_PRO_MODEL_ID,
  OPENAI_CODEX_GPT_54_MINI_MODEL_ID,
  "gpt-5.2",
  "gpt-5.2-codex",
  OPENAI_CODEX_GPT_53_MODEL_ID,
  OPENAI_CODEX_GPT_53_SPARK_MODEL_ID,
] as const;

function applyOpenAICodexAuthConfig(
  cfg: ProviderAuthContext["config"],
): ProviderAuthContext["config"] {
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        models: {
          ...cfg.agents?.defaults?.models,
          [OPENAI_CODEX_DEFAULT_MODEL]: {},
        },
      },
    },
  };
}

function isLegacyCodexCompatBaseUrl(baseUrl?: string): boolean {
  const trimmed = baseUrl?.trim();
  return !!trimmed && /^https?:\/\/api\.githubcopilot\.com(?:\/v1)?\/?$/i.test(trimmed);
}

function normalizeCodexTransportFields(params: {
  api?: ProviderRuntimeModel["api"] | null;
  baseUrl?: string;
}): { api?: ProviderRuntimeModel["api"]; baseUrl?: string } {
  const useCodexTransport =
    !params.baseUrl ||
    isOpenAIApiBaseUrl(params.baseUrl) ||
    isOpenAICodexBaseUrl(params.baseUrl) ||
    isLegacyCodexCompatBaseUrl(params.baseUrl);
  const api =
    useCodexTransport &&
    (!params.api || params.api === "openai-responses" || params.api === "openai-completions")
      ? "openai-codex-responses"
      : (params.api ?? undefined);
  const baseUrl =
    api === "openai-codex-responses" && useCodexTransport
      ? OPENAI_CODEX_BASE_URL
      : params.baseUrl;
  return { api, baseUrl };
}

function normalizeCodexTransport(model: ProviderRuntimeModel): ProviderRuntimeModel {
  const lowerModelId = model.id.trim().toLowerCase();
  const canonicalModelId =
    lowerModelId === OPENAI_CODEX_GPT_54_LEGACY_MODEL_ID
      ? OPENAI_CODEX_GPT_54_MODEL_ID
      : model.id;
  const canonicalName =
    model.name.trim().toLowerCase() === OPENAI_CODEX_GPT_54_LEGACY_MODEL_ID
      ? OPENAI_CODEX_GPT_54_MODEL_ID
      : model.name;
  const normalized = normalizeCodexTransportFields({ api: model.api, baseUrl: model.baseUrl });
  const api = normalized.api ?? model.api;
  const baseUrl = normalized.baseUrl ?? model.baseUrl;
  if (
    api === model.api &&
    baseUrl === model.baseUrl &&
    canonicalModelId === model.id &&
    canonicalName === model.name
  ) {
    return model;
  }
  return {
    ...model,
    id: canonicalModelId,
    name: canonicalName,
    api,
    baseUrl,
  };
}

function withDefaultCodexContextMetadata(params: {
  model: ProviderRuntimeModel | undefined;
  contextWindow: number;
  contextTokens: number;
}): ProviderRuntimeModel | undefined {
  if (!params.model) {
    return undefined;
  }
  const contextTokens =
    typeof params.model.contextTokens === "number"
      ? params.model.contextTokens
      : typeof params.model.contextWindow === "number" && params.model.contextWindow > 0
        ? Math.min(params.contextTokens, params.model.contextWindow)
        : params.contextTokens;
  return {
    ...params.model,
    contextWindow: params.contextWindow,
    contextTokens,
  };
}

function resolveCodexForwardCompatModel(
  ctx: ProviderResolveDynamicModelContext,
): ProviderRuntimeModel | undefined {
  const trimmedModelId = ctx.modelId.trim();
  const lower = trimmedModelId.toLowerCase();
  const canonicalModelId =
    lower === OPENAI_CODEX_GPT_54_LEGACY_MODEL_ID
      ? OPENAI_CODEX_GPT_54_MODEL_ID
      : trimmedModelId;
  const synthBaseUrl = ctx.providerConfig?.baseUrl ?? OPENAI_CODEX_BASE_URL;

  if (lower === OPENAI_CODEX_GPT_55_MODEL_ID) {
    const model = ctx.modelRegistry.find(PROVIDER_ID, trimmedModelId) as
      | ProviderRuntimeModel
      | undefined;
    return (
      withDefaultCodexContextMetadata({
        model,
        contextWindow: OPENAI_CODEX_GPT_55_CODEX_CONTEXT_TOKENS,
        contextTokens: OPENAI_CODEX_GPT_55_DEFAULT_RUNTIME_CONTEXT_TOKENS,
      }) ??
      normalizeModelCompat({
        id: trimmedModelId,
        name: trimmedModelId,
        api: "openai-codex-responses",
        provider: PROVIDER_ID,
        baseUrl: synthBaseUrl,
        reasoning: true,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: OPENAI_CODEX_GPT_55_CODEX_CONTEXT_TOKENS,
        contextTokens: OPENAI_CODEX_GPT_55_DEFAULT_RUNTIME_CONTEXT_TOKENS,
        maxTokens: OPENAI_CODEX_GPT_54_MAX_TOKENS,
      } as ProviderRuntimeModel)
    );
  }

  let templateIds: readonly string[];
  let patch: Partial<ProviderRuntimeModel> | undefined;
  if (lower === OPENAI_CODEX_GPT_55_PRO_MODEL_ID) {
    templateIds = OPENAI_CODEX_GPT_55_PRO_TEMPLATE_MODEL_IDS;
    patch = {
      contextWindow: OPENAI_CODEX_GPT_55_PRO_CONTEXT_TOKENS,
      contextTokens: OPENAI_CODEX_GPT_55_PRO_DEFAULT_CONTEXT_TOKENS,
      maxTokens: OPENAI_CODEX_GPT_54_MAX_TOKENS,
      cost: OPENAI_CODEX_GPT_55_PRO_COST,
    };
  } else if (
    lower === OPENAI_CODEX_GPT_54_MODEL_ID ||
    lower === OPENAI_CODEX_GPT_54_LEGACY_MODEL_ID
  ) {
    templateIds = OPENAI_CODEX_GPT_54_CATALOG_TEMPLATE_MODEL_IDS;
    patch = {
      contextWindow: OPENAI_CODEX_GPT_54_CONTEXT_TOKENS,
      contextTokens: OPENAI_CODEX_GPT_54_DEFAULT_CONTEXT_TOKENS,
      maxTokens: OPENAI_CODEX_GPT_54_MAX_TOKENS,
      cost: OPENAI_CODEX_GPT_54_COST,
    };
  } else if (lower === OPENAI_CODEX_GPT_54_PRO_MODEL_ID) {
    templateIds = OPENAI_CODEX_GPT_54_CATALOG_TEMPLATE_MODEL_IDS;
    patch = {
      contextWindow: OPENAI_CODEX_GPT_54_CONTEXT_TOKENS,
      contextTokens: OPENAI_CODEX_GPT_54_DEFAULT_CONTEXT_TOKENS,
      maxTokens: OPENAI_CODEX_GPT_54_MAX_TOKENS,
      cost: OPENAI_CODEX_GPT_54_PRO_COST,
    };
  } else if (lower === OPENAI_CODEX_GPT_54_MINI_MODEL_ID) {
    templateIds = OPENAI_CODEX_GPT_54_CATALOG_TEMPLATE_MODEL_IDS;
    patch = {
      contextWindow: OPENAI_CODEX_GPT_54_MINI_CONTEXT_TOKENS,
      contextTokens: OPENAI_CODEX_GPT_54_DEFAULT_CONTEXT_TOKENS,
      maxTokens: OPENAI_CODEX_GPT_54_MAX_TOKENS,
      cost: OPENAI_CODEX_GPT_54_MINI_COST,
    };
  } else if (lower === OPENAI_CODEX_GPT_53_SPARK_MODEL_ID) {
    templateIds = [OPENAI_CODEX_GPT_53_MODEL_ID, ...OPENAI_CODEX_TEMPLATE_MODEL_IDS];
    patch = {
      api: "openai-codex-responses",
      provider: PROVIDER_ID,
      baseUrl: OPENAI_CODEX_BASE_URL,
      reasoning: true,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: OPENAI_CODEX_GPT_53_SPARK_CONTEXT_TOKENS,
      maxTokens: OPENAI_CODEX_GPT_53_SPARK_MAX_TOKENS,
    };
  } else if (lower === OPENAI_CODEX_GPT_53_MODEL_ID) {
    templateIds = OPENAI_CODEX_TEMPLATE_MODEL_IDS;
  } else {
    return undefined;
  }

  return (
    cloneFirstTemplateModel({
      providerId: PROVIDER_ID,
      modelId: canonicalModelId,
      templateIds,
      ctx,
      patch,
    }) ??
    normalizeModelCompat({
      id: canonicalModelId,
      name: canonicalModelId,
      api: "openai-codex-responses",
      provider: PROVIDER_ID,
      baseUrl: synthBaseUrl,
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: patch?.contextWindow ?? DEFAULT_CONTEXT_TOKENS,
      contextTokens: patch?.contextTokens,
      maxTokens: patch?.maxTokens ?? DEFAULT_CONTEXT_TOKENS,
    } as ProviderRuntimeModel)
  );
}

async function refreshOpenAICodexOAuthCredential(cred: OAuthCredential) {
  try {
    const { refreshOpenAICodexToken } = await import("./openai-codex-provider.runtime.js");
    const refreshed = await refreshOpenAICodexToken(cred.refresh);
    return {
      ...cred,
      ...refreshed,
      type: "oauth" as const,
      provider: PROVIDER_ID,
      email: cred.email,
      displayName: cred.displayName,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /extract\s+accountid\s+from\s+token/i.test(message) &&
      typeof cred.access === "string" &&
      cred.access.trim().length > 0
    ) {
      return cred;
    }
    throw error;
  }
}

async function runOpenAICodexOAuth(ctx: ProviderAuthContext) {
  let creds;
  try {
    creds = await loginOpenAICodexOAuth({
      prompter: ctx.prompter,
      runtime: ctx.runtime,
      isRemote: ctx.isRemote,
      openUrl: ctx.openUrl,
      localBrowserMessage: "Complete sign-in in browser…",
    });
  } catch {
    return { profiles: [] };
  }
  if (!creds) {
    return { profiles: [] };
  }

  const identity = resolveCodexAuthIdentity({
    accessToken: creds.access,
    email: typeof creds.email === "string" ? creds.email : undefined,
  });

  return buildOauthProviderAuthResult({
    providerId: PROVIDER_ID,
    defaultModel: OPENAI_CODEX_DEFAULT_MODEL,
    access: creds.access,
    refresh: creds.refresh,
    expires: creds.expires,
    email: identity.email,
    profileName: identity.profileName,
  });
}

function buildOpenAICodexAuthDoctorHint(ctx: { profileId?: string }) {
  if (ctx.profileId !== CODEX_CLI_PROFILE_ID) {
    return undefined;
  }
  return "Deprecated profile. Run `coreblow models auth login --provider openai-codex` or `coreblow configure`.";
}

export function buildOpenAICodexProviderPlugin(): ProviderPlugin {
  return {
    id: PROVIDER_ID,
    label: "OpenAI Codex",
    docsPath: "/providers/models",
    deprecatedProfileIds: [CODEX_CLI_PROFILE_ID],
    oauthProfileIdRepairs: [
      {
        legacyProfileId: "openai-codex:default",
        promptLabel: "OpenAI Codex",
      },
    ],
    auth: [
      {
        id: "oauth",
        label: OPENAI_CODEX_LOGIN_LABEL,
        hint: OPENAI_CODEX_LOGIN_HINT,
        kind: "oauth",
        wizard: {
          choiceId: "openai-codex",
          choiceLabel: OPENAI_CODEX_LOGIN_LABEL,
          choiceHint: OPENAI_CODEX_LOGIN_HINT,
          ...OPENAI_CODEX_WIZARD_GROUP,
        },
        run: async (ctx) => await runOpenAICodexOAuth(ctx),
      },
      createProviderApiKeyAuthMethod({
        providerId: "openai",
        methodId: "api-key",
        label: OPENAI_CODEX_API_KEY_BACKUP_LABEL,
        hint: OPENAI_CODEX_API_KEY_BACKUP_HINT,
        optionKey: "openaiApiKey",
        flagName: "--openai-api-key",
        envVar: "OPENAI_API_KEY",
        promptMessage: "Enter OpenAI API key",
        profileId: "openai:default",
        defaultModel: OPENAI_CODEX_DEFAULT_MODEL,
        expectedProviders: ["openai"],
        applyConfig: applyOpenAICodexAuthConfig,
        wizard: {
          choiceId: "openai-codex-api-key",
          choiceLabel: OPENAI_CODEX_API_KEY_BACKUP_LABEL,
          choiceHint: OPENAI_CODEX_API_KEY_BACKUP_HINT,
          ...OPENAI_CODEX_WIZARD_GROUP,
        },
      }),
    ],
    wizard: {
      setup: {
        choiceId: "openai-codex",
        choiceLabel: OPENAI_CODEX_LOGIN_LABEL,
        choiceHint: OPENAI_CODEX_LOGIN_HINT,
        methodId: "oauth",
      },
    },
    catalog: {
      order: "profile",
      run: async (ctx) => {
        const authStore = ensureAuthProfileStore(ctx.agentDir, {
          allowKeychainPrompt: false,
        });
        if (listProfilesForProvider(authStore, PROVIDER_ID).length === 0) {
          return null;
        }
        return {
          provider: buildOpenAICodexProvider(),
        };
      },
    },
    resolveDynamicModel: (ctx) => resolveCodexForwardCompatModel(ctx),
    buildAuthDoctorHint: (ctx) => buildOpenAICodexAuthDoctorHint(ctx),
    capabilities: {
      providerFamily: "openai",
    },
    resolveReasoningOutputMode: () => "native",
    supportsXHighThinking: ({ modelId }) =>
      matchesExactOrPrefix(modelId, OPENAI_CODEX_XHIGH_MODEL_IDS),
    isModernModelRef: ({ modelId }) => matchesExactOrPrefix(modelId, OPENAI_CODEX_MODERN_MODEL_IDS),
    ...buildOpenAIResponsesProviderHooks(),
    ...buildOpenAIToolCompatProviderHooks(),
    normalizeResolvedModel: (ctx) => {
      if (normalizeProviderId(ctx.provider) !== PROVIDER_ID) {
        return undefined;
      }
      return normalizeCodexTransport(ctx.model);
    },
    normalizeTransport: ({ provider, api, baseUrl }) => {
      if (normalizeProviderId(provider) !== PROVIDER_ID) {
        return undefined;
      }
      const normalized = normalizeCodexTransportFields({ api, baseUrl });
      if (normalized.api === api && normalized.baseUrl === baseUrl) {
        return undefined;
      }
      return normalized;
    },
    resolveUsageAuth: async (ctx) => await ctx.resolveOAuthToken(),
    fetchUsageSnapshot: async (ctx) =>
      await fetchCodexUsage(ctx.token, ctx.accountId, ctx.timeoutMs, ctx.fetchFn),
    refreshOAuth: async (cred) => await refreshOpenAICodexOAuthCredential(cred),
    augmentModelCatalog: (ctx) => {
      const gpt54Template = findCatalogTemplate({
        entries: ctx.entries,
        providerId: PROVIDER_ID,
        templateIds: OPENAI_CODEX_GPT_54_CATALOG_TEMPLATE_MODEL_IDS,
      });
      const gpt55ProTemplate = findCatalogTemplate({
        entries: ctx.entries,
        providerId: PROVIDER_ID,
        templateIds: OPENAI_CODEX_GPT_55_PRO_TEMPLATE_MODEL_IDS,
      });
      const sparkTemplate = findCatalogTemplate({
        entries: ctx.entries,
        providerId: PROVIDER_ID,
        templateIds: [OPENAI_CODEX_GPT_53_MODEL_ID, ...OPENAI_CODEX_TEMPLATE_MODEL_IDS],
      });
      return [
        buildOpenAISyntheticCatalogEntry(gpt55ProTemplate, {
          id: OPENAI_CODEX_GPT_55_PRO_MODEL_ID,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: OPENAI_CODEX_GPT_55_PRO_CONTEXT_TOKENS,
          contextTokens: OPENAI_CODEX_GPT_55_PRO_DEFAULT_CONTEXT_TOKENS,
          cost: OPENAI_CODEX_GPT_55_PRO_COST,
        }),
        buildOpenAISyntheticCatalogEntry(gpt54Template, {
          id: OPENAI_CODEX_GPT_54_MODEL_ID,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: OPENAI_CODEX_GPT_54_CONTEXT_TOKENS,
          contextTokens: OPENAI_CODEX_GPT_54_DEFAULT_CONTEXT_TOKENS,
          cost: OPENAI_CODEX_GPT_54_COST,
        }),
        buildOpenAISyntheticCatalogEntry(gpt54Template, {
          id: OPENAI_CODEX_GPT_54_PRO_MODEL_ID,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: OPENAI_CODEX_GPT_54_CONTEXT_TOKENS,
          contextTokens: OPENAI_CODEX_GPT_54_DEFAULT_CONTEXT_TOKENS,
          cost: OPENAI_CODEX_GPT_54_PRO_COST,
        }),
        buildOpenAISyntheticCatalogEntry(gpt54Template, {
          id: OPENAI_CODEX_GPT_54_MINI_MODEL_ID,
          reasoning: true,
          input: ["text", "image"],
          contextWindow: OPENAI_CODEX_GPT_54_MINI_CONTEXT_TOKENS,
          contextTokens: OPENAI_CODEX_GPT_54_DEFAULT_CONTEXT_TOKENS,
          cost: OPENAI_CODEX_GPT_54_MINI_COST,
        }),
        buildOpenAISyntheticCatalogEntry(sparkTemplate, {
          id: OPENAI_CODEX_GPT_53_SPARK_MODEL_ID,
          reasoning: true,
          input: ["text"],
          contextWindow: OPENAI_CODEX_GPT_53_SPARK_CONTEXT_TOKENS,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        }),
      ].filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
    },
  };
}
