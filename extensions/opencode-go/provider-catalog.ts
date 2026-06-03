import type { ProviderRuntimeModel } from "../../src/plugins/types.js";

const PROVIDER_ID = "opencode-go";
const OPENCODE_GO_OPENAI_BASE_URL = "https://opencode.ai/zen/go/v1";
const OPENCODE_GO_ANTHROPIC_BASE_URL = "https://opencode.ai/zen/go";
const OPENCODE_GO_KIMI_NO_REASONING_MODEL_IDS = new Set(["kimi-k2.5", "kimi-k2.6"]);

const OPENCODE_GO_SUPPLEMENTAL_MODELS: ProviderRuntimeModel[] = [
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    api: "openai-completions",
    provider: PROVIDER_ID,
    baseUrl: OPENCODE_GO_OPENAI_BASE_URL,
    reasoning: true,
    input: ["text"],
    cost: { input: 1.74, output: 3.48, cacheRead: 0.145, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    compat: {
      supportsUsageInStreaming: true,
      supportsReasoningEffort: true,
      maxTokensField: "max_tokens",
    },
  },
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    api: "openai-completions",
    provider: PROVIDER_ID,
    baseUrl: OPENCODE_GO_OPENAI_BASE_URL,
    reasoning: true,
    input: ["text"],
    cost: { input: 0.14, output: 0.28, cacheRead: 0.028, cacheWrite: 0 },
    contextWindow: 1_000_000,
    maxTokens: 384_000,
    compat: {
      supportsUsageInStreaming: true,
      supportsReasoningEffort: true,
      maxTokensField: "max_tokens",
    },
  },
];

export function listOpencodeGoSupplementalModelCatalogEntries() {
  return OPENCODE_GO_SUPPLEMENTAL_MODELS.map((model) => ({
    provider: model.provider,
    id: model.id,
    name: model.name,
    reasoning: model.reasoning,
    input: model.input,
    contextWindow: model.contextWindow,
  }));
}

export function resolveOpencodeGoSupplementalModel(modelId: string): ProviderRuntimeModel | undefined {
  const normalizedModelId = modelId.trim().toLowerCase();
  return OPENCODE_GO_SUPPLEMENTAL_MODELS.find((model) => model.id === normalizedModelId);
}

export function isOpencodeGoKimiNoReasoningModelId(modelId: unknown): boolean {
  return (
    typeof modelId === "string" &&
    OPENCODE_GO_KIMI_NO_REASONING_MODEL_IDS.has(modelId.trim().toLowerCase())
  );
}

export function normalizeOpencodeGoResolvedModel(
  model: ProviderRuntimeModel,
): ProviderRuntimeModel | undefined {
  if (!isOpencodeGoKimiNoReasoningModelId(model.id)) {
    return undefined;
  }
  const compat =
    model.compat && typeof model.compat === "object" && !Array.isArray(model.compat)
      ? (model.compat as Record<string, unknown>)
      : undefined;
  if (!model.reasoning && compat?.supportsReasoningEffort !== true) {
    return undefined;
  }
  return {
    ...model,
    reasoning: false,
    compat: {
      ...compat,
      supportsReasoningEffort: false,
    },
  } as ProviderRuntimeModel;
}

function normalizeBaseUrl(baseUrl: string | undefined): string {
  return (baseUrl ?? "").trim().replace(/\/+$/, "");
}

export function normalizeOpencodeGoBaseUrl(params: { api?: string | null; baseUrl?: string }): string | undefined {
  const normalized = normalizeBaseUrl(params.baseUrl);
  if (!normalized) {
    return undefined;
  }
  if (normalized === OPENCODE_GO_OPENAI_BASE_URL) {
    return OPENCODE_GO_OPENAI_BASE_URL;
  }
  if (normalized === OPENCODE_GO_ANTHROPIC_BASE_URL) {
    return OPENCODE_GO_ANTHROPIC_BASE_URL;
  }
  if (normalized === "https://opencode.ai/go") {
    return OPENCODE_GO_ANTHROPIC_BASE_URL;
  }
  if (normalized === "https://opencode.ai/go/v1") {
    return params.api === "anthropic-messages"
      ? OPENCODE_GO_ANTHROPIC_BASE_URL
      : OPENCODE_GO_OPENAI_BASE_URL;
  }
  return undefined;
}
