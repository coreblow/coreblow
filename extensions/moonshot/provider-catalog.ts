import type { ModelDefinitionConfig, ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";

export const MOONSHOT_BASE_URL = "https://api.moonshot.ai/v1";
export const MOONSHOT_CN_BASE_URL = "https://api.moonshot.cn/v1";
export const MOONSHOT_DEFAULT_MODEL_ID = "kimi-k2.6";

const MOONSHOT_DEFAULT_CONTEXT_WINDOW = 262_144;
const MOONSHOT_DEFAULT_MAX_TOKENS = 262_144;
const ZERO_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
} as const;

const MOONSHOT_MODEL_CATALOG: ReadonlyArray<ModelDefinitionConfig> = [
  {
    id: "kimi-k2.6",
    name: "Kimi K2.6",
    reasoning: false,
    input: ["text", "image"],
    cost: {
      input: 0.95,
      output: 4,
      cacheRead: 0.16,
      cacheWrite: 0,
    },
    contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
  },
  {
    id: "kimi-k2.5",
    name: "Kimi K2.5",
    reasoning: false,
    input: ["text", "image"],
    cost: {
      input: 0.6,
      output: 3,
      cacheRead: 0.1,
      cacheWrite: 0,
    },
    contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
  },
  {
    id: "kimi-k2-thinking",
    name: "Kimi K2 Thinking",
    reasoning: true,
    input: ["text"],
    cost: ZERO_COST,
    contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
  },
  {
    id: "kimi-k2-thinking-turbo",
    name: "Kimi K2 Thinking Turbo",
    reasoning: true,
    input: ["text"],
    cost: ZERO_COST,
    contextWindow: MOONSHOT_DEFAULT_CONTEXT_WINDOW,
    maxTokens: MOONSHOT_DEFAULT_MAX_TOKENS,
  },
  {
    id: "kimi-k2-turbo",
    name: "Kimi K2 Turbo",
    reasoning: false,
    input: ["text"],
    cost: ZERO_COST,
    contextWindow: 256_000,
    maxTokens: 16_384,
  },
];

function normalizeMoonshotBaseUrl(baseUrl: string | undefined): string {
  const trimmed = baseUrl?.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/+$/, "").toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

function cloneMoonshotModel(model: ModelDefinitionConfig): ModelDefinitionConfig {
  return {
    ...model,
    input: [...model.input],
    cost: { ...model.cost },
    compat: model.compat ? { ...model.compat } : undefined,
  };
}

function withStreamingUsageCompat(provider: ModelProviderConfig): ModelProviderConfig {
  if (!Array.isArray(provider.models) || provider.models.length === 0) {
    return provider;
  }

  let changed = false;
  const models = provider.models.map((model) => {
    if (model.compat?.supportsUsageInStreaming !== undefined) {
      return model;
    }

    changed = true;
    return {
      ...model,
      compat: {
        ...model.compat,
        supportsUsageInStreaming: true,
      },
    };
  });

  return changed ? { ...provider, models } : provider;
}

export function isNativeMoonshotBaseUrl(baseUrl: string | undefined): boolean {
  const normalized = normalizeMoonshotBaseUrl(baseUrl);
  return normalized === MOONSHOT_BASE_URL || normalized === MOONSHOT_CN_BASE_URL;
}

export function applyMoonshotNativeStreamingUsageCompat(
  provider: ModelProviderConfig,
): ModelProviderConfig {
  return isNativeMoonshotBaseUrl(provider.baseUrl) ? withStreamingUsageCompat(provider) : provider;
}

export function buildMoonshotProvider(): ModelProviderConfig {
  return {
    baseUrl: MOONSHOT_BASE_URL,
    api: "openai-completions",
    models: MOONSHOT_MODEL_CATALOG.map(cloneMoonshotModel),
  };
}
