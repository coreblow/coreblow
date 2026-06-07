import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import { OLLAMA_DEFAULT_BASE_URL } from "./src/defaults.js";

type OllamaProviderConfigDraft = Partial<ModelProviderConfig>;
type ProviderThinkingProfile = {
  levels: Array<{ id: "off" | "low" | "medium" | "high" | "max" }>;
  defaultLevel: "off" | "low" | "medium" | "high" | "max";
};

const OLLAMA_REASONING_THINKING_PROFILE = {
  levels: [{ id: "off" }, { id: "low" }, { id: "medium" }, { id: "high" }, { id: "max" }],
  defaultLevel: "off",
} satisfies ProviderThinkingProfile;

const OLLAMA_NON_REASONING_THINKING_PROFILE = {
  levels: [{ id: "off" }],
  defaultLevel: "off",
} satisfies ProviderThinkingProfile;

export function normalizeConfig({
  provider,
  providerConfig,
}: {
  provider: string;
  providerConfig: OllamaProviderConfigDraft;
}): OllamaProviderConfigDraft {
  if ((provider ?? "").trim().toLowerCase() !== "ollama") {
    return providerConfig;
  }
  const next = { ...providerConfig };
  if (typeof next.baseUrl !== "string" || !next.baseUrl.trim()) {
    next.baseUrl = OLLAMA_DEFAULT_BASE_URL;
  }
  if (!Array.isArray(next.models)) {
    next.models = [];
  }
  return next;
}

export function resolveThinkingProfile({
  reasoning,
}: {
  reasoning?: boolean;
}): ProviderThinkingProfile {
  return reasoning ? OLLAMA_REASONING_THINKING_PROFILE : OLLAMA_NON_REASONING_THINKING_PROFILE;
}
