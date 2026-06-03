import type { ModelDefinitionConfig, ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import { DEEPSEEK_MODEL_CATALOG } from "./models.js";
import { resolveDeepSeekV4ThinkingProfile } from "./thinking.js";

type ModelDefinitionDraft = Partial<ModelDefinitionConfig> &
  Pick<ModelDefinitionConfig, "id" | "name">;

function buildCatalogIndex(): Map<string, ModelDefinitionConfig> {
  const index = new Map<string, ModelDefinitionConfig>();
  for (const model of DEEPSEEK_MODEL_CATALOG) {
    index.set(model.id, model);
  }
  return index;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasCostValues(cost: unknown): cost is ModelDefinitionConfig["cost"] {
  if (!cost || typeof cost !== "object") {
    return false;
  }
  const c = cost as Record<string, unknown>;
  return (
    typeof c.input === "number" ||
    typeof c.output === "number" ||
    typeof c.cacheRead === "number" ||
    typeof c.cacheWrite === "number"
  );
}

export function normalizeConfig(params: {
  provider: string;
  providerConfig: ModelProviderConfig;
}): ModelProviderConfig {
  const { providerConfig } = params;
  if (!Array.isArray(providerConfig.models) || providerConfig.models.length === 0) {
    return providerConfig;
  }

  const catalog = buildCatalogIndex();
  let mutated = false;

  const nextModels = providerConfig.models.map((model) => {
    const raw = model as ModelDefinitionDraft;
    const catalogEntry = catalog.get(raw.id);
    if (!catalogEntry) {
      return model;
    }

    let modelMutated = false;
    const patched: Record<string, unknown> = {};

    if (!isPositiveNumber(raw.contextWindow) && isPositiveNumber(catalogEntry.contextWindow)) {
      patched.contextWindow = catalogEntry.contextWindow;
      modelMutated = true;
    }

    if (!isPositiveNumber(raw.maxTokens) && isPositiveNumber(catalogEntry.maxTokens)) {
      patched.maxTokens = catalogEntry.maxTokens;
      modelMutated = true;
    }

    if (!hasCostValues(raw.cost) && hasCostValues(catalogEntry.cost)) {
      patched.cost = catalogEntry.cost;
      modelMutated = true;
    }

    if (!modelMutated) {
      return model;
    }

    mutated = true;
    return { ...raw, ...patched };
  });

  if (!mutated) {
    return providerConfig;
  }

  return { ...providerConfig, models: nextModels as ModelDefinitionConfig[] };
}

export function resolveThinkingProfile(params: { modelId: string; provider?: string }) {
  if (params.provider && params.provider.trim().toLowerCase() !== "deepseek") {
    return null;
  }
  return resolveDeepSeekV4ThinkingProfile(params.modelId);
}
