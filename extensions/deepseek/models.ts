import type { ModelDefinitionConfig } from "coreblow/plugin-sdk/provider-model-shared";

export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export const DEEPSEEK_MODEL_CATALOG: ModelDefinitionConfig[] = [
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    reasoning: true,
    input: ["text"],
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    cost: {
      input: 0.14,
      output: 0.28,
      cacheRead: 0.028,
      cacheWrite: 0,
    },
    compat: {
      supportsUsageInStreaming: true,
      supportsReasoningEffort: true,
      maxTokensField: "max_tokens",
    },
  },
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    reasoning: true,
    input: ["text"],
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    cost: {
      input: 1.74,
      output: 3.48,
      cacheRead: 0.145,
      cacheWrite: 0,
    },
    compat: {
      supportsUsageInStreaming: true,
      supportsReasoningEffort: true,
      maxTokensField: "max_tokens",
    },
  },
  {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    reasoning: false,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 8192,
    cost: {
      input: 0.28,
      output: 0.42,
      cacheRead: 0.028,
      cacheWrite: 0,
    },
    compat: {
      supportsUsageInStreaming: true,
      maxTokensField: "max_tokens",
    },
  },
  {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    reasoning: true,
    input: ["text"],
    contextWindow: 131072,
    maxTokens: 65536,
    cost: {
      input: 0.28,
      output: 0.42,
      cacheRead: 0.028,
      cacheWrite: 0,
    },
    compat: {
      supportsUsageInStreaming: true,
      supportsReasoningEffort: false,
      maxTokensField: "max_tokens",
    },
  },
];

const DEEPSEEK_V4_MODEL_IDS = new Set(["deepseek-v4-flash", "deepseek-v4-pro"]);

export function isDeepSeekV4ModelId(modelId: string): boolean {
  return DEEPSEEK_V4_MODEL_IDS.has(modelId.trim().toLowerCase());
}

export function isDeepSeekV4ModelRef(model: { provider?: string; id?: unknown }): boolean {
  return (
    model.provider === "deepseek" &&
    typeof model.id === "string" &&
    isDeepSeekV4ModelId(model.id)
  );
}

export function buildDeepSeekModelDefinition(
  model: (typeof DEEPSEEK_MODEL_CATALOG)[number],
): ModelDefinitionConfig {
  const cost = {
    input: model.cost.input,
    output: model.cost.output,
    cacheRead: model.cost.cacheRead,
    cacheWrite: model.cost.cacheWrite,
  };

  return {
    id: model.id,
    name: model.name,
    api: "openai-completions",
    reasoning: model.reasoning,
    input: [...model.input],
    cost,
    contextWindow: model.contextWindow,
    maxTokens: model.maxTokens,
    compat: model.compat ? { ...model.compat } : undefined,
  };
}
