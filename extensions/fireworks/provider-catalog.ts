import type {
  ModelDefinitionConfig,
  ModelProviderConfig,
} from "coreblow/plugin-sdk/provider-model-shared";

export const FIREWORKS_BASE_URL = "https://api.fireworks.ai/inference/v1";
export const FIREWORKS_DEFAULT_MODEL_ID = "accounts/fireworks/routers/kimi-k2p5-turbo";
export const FIREWORKS_K2_6_MODEL_ID = "accounts/fireworks/models/kimi-k2p6";

const FIREWORKS_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
};

const FIREWORKS_K2_6_COST = {
  input: 0.95,
  output: 4,
  cacheRead: 0,
  cacheWrite: 0,
};

export const FIREWORKS_DEFAULT_CONTEXT_WINDOW = 256000;
export const FIREWORKS_DEFAULT_MAX_TOKENS = 256000;
export const FIREWORKS_K2_6_CONTEXT_WINDOW = 262144;
export const FIREWORKS_K2_6_MAX_TOKENS = 262144;

const FIREWORKS_MODEL_CATALOG = [
  {
    id: FIREWORKS_K2_6_MODEL_ID,
    name: "Kimi K2.6",
    reasoning: false,
    input: ["text", "image"],
    contextWindow: FIREWORKS_K2_6_CONTEXT_WINDOW,
    maxTokens: FIREWORKS_K2_6_MAX_TOKENS,
    cost: FIREWORKS_K2_6_COST,
  },
  {
    id: FIREWORKS_DEFAULT_MODEL_ID,
    name: "Kimi K2.5 Turbo (Fire Pass)",
    reasoning: false,
    input: ["text", "image"],
    contextWindow: FIREWORKS_DEFAULT_CONTEXT_WINDOW,
    maxTokens: FIREWORKS_DEFAULT_MAX_TOKENS,
    compat: {
      unsupportedToolSchemaKeywords: ["not"],
    },
    cost: FIREWORKS_DEFAULT_COST,
  },
] as const satisfies readonly ModelDefinitionConfig[];

function cloneFireworksCatalogModel(model: ModelDefinitionConfig): ModelDefinitionConfig {
  return {
    ...model,
    input: [...model.input],
    cost: { ...model.cost },
    ...(model.compat ? { compat: { ...model.compat } } : {}),
  };
}

export function buildFireworksCatalogModels(): ModelDefinitionConfig[] {
  return FIREWORKS_MODEL_CATALOG.map(cloneFireworksCatalogModel);
}

export function buildFireworksProvider(): ModelProviderConfig {
  return {
    baseUrl: FIREWORKS_BASE_URL,
    api: "openai-completions",
    models: buildFireworksCatalogModels(),
  };
}
