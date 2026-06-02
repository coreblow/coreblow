import type { ModelDefinitionConfig } from "coreblow/plugin-sdk/provider-model-shared";

export const TOKENHUB_PROVIDER_ID = "tencent-tokenhub";
export const TOKENHUB_BASE_URL = "https://tokenhub.tencentmaas.com/v1";

export const TOKENHUB_MODEL_CATALOG = [
  {
    id: "hy3-preview",
    name: "Hy3 preview (TokenHub)",
    reasoning: true,
    input: ["text"],
    contextWindow: 256000,
    maxTokens: 64000,
    cost: {
      input: 0.176,
      output: 0.587,
      cacheRead: 0.059,
      cacheWrite: 0,
    },
    compat: {
      supportsUsageInStreaming: true,
      supportsReasoningEffort: true,
    },
  },
] as const satisfies readonly Omit<ModelDefinitionConfig, "api">[];

export function buildTokenHubModelDefinition(
  model: (typeof TOKENHUB_MODEL_CATALOG)[number],
): ModelDefinitionConfig {
  return {
    ...model,
    input: [...model.input],
    cost: { ...model.cost },
    compat: { ...model.compat },
    api: "openai-completions",
  };
}
