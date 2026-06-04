import { applyMistralModelCompat } from "./api.js";

const MISTRAL_MODEL_HINTS = [
  "mistral",
  "mistralai",
  "mixtral",
  "codestral",
  "pixtral",
  "devstral",
  "ministral",
] as const;

function normalizeLowercaseString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function readStringValue(value: unknown): string | undefined {
  const normalized = normalizeLowercaseString(value);
  return normalized || undefined;
}

function isMistralModelHint(modelId: string): boolean {
  const normalized = normalizeLowercaseString(modelId);
  return MISTRAL_MODEL_HINTS.some(
    (hint) =>
      normalized === hint ||
      normalized.startsWith(`${hint}/`) ||
      normalized.startsWith(`${hint}-`) ||
      normalized.startsWith(`${hint}:`),
  );
}

function isMistralEndpoint(baseUrl: unknown): boolean {
  const normalized = normalizeLowercaseString(baseUrl);
  return normalized.includes("api.mistral.ai") || normalized.includes("mistral");
}

function shouldContributeMistralCompat(params: {
  modelId: string;
  model: { api?: unknown; baseUrl?: unknown; provider?: unknown };
}): boolean {
  if (params.model.api !== "openai-completions") {
    return false;
  }

  const provider = readStringValue(params.model.provider);
  return (
    provider === "mistral" ||
    provider === "mistralai" ||
    isMistralEndpoint(params.model.baseUrl) ||
    isMistralModelHint(params.modelId)
  );
}

export function contributeMistralResolvedModelCompat<T extends { compat?: unknown }>(params: {
  modelId: string;
  model: T & { api?: unknown; baseUrl?: unknown; provider?: unknown };
}): T | undefined {
  return shouldContributeMistralCompat(params) ? applyMistralModelCompat(params.model) : undefined;
}
