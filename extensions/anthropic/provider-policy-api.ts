import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import {
  applyAnthropicConfigDefaults,
  normalizeAnthropicProviderConfigForProvider,
} from "./config-defaults.js";

type ThinkingLevelId = "off" | "minimal" | "low" | "medium" | "high" | "adaptive" | "xhigh";
type AnthropicThinkingProfile = {
  levels: Array<{ id: ThinkingLevelId }>;
  defaultLevel: Exclude<ThinkingLevelId, "xhigh">;
};

function normalizeModelId(modelId: string): string {
  return modelId.trim().toLowerCase();
}

function matchesAnyPrefix(modelId: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => modelId.startsWith(prefix));
}

export function normalizeConfig(params: {
  provider: string;
  providerConfig: ModelProviderConfig;
}) {
  return normalizeAnthropicProviderConfigForProvider(params);
}

export function applyConfigDefaults(params: Parameters<typeof applyAnthropicConfigDefaults>[0]) {
  return applyAnthropicConfigDefaults(params);
}

export function resolveThinkingProfile(params: {
  provider: string;
  modelId: string;
}): AnthropicThinkingProfile | null {
  const provider = params.provider.trim().toLowerCase();
  if (provider !== "anthropic" && provider !== "claude-cli") {
    return null;
  }
  const modelId = normalizeModelId(params.modelId);
  if (matchesAnyPrefix(modelId, ["claude-opus-4-6", "claude-opus-4.6"])) {
    return {
      levels: [
        { id: "off" },
        { id: "minimal" },
        { id: "low" },
        { id: "medium" },
        { id: "high" },
        { id: "xhigh" },
        { id: "adaptive" },
      ],
      defaultLevel: "adaptive",
    };
  }
  if (
    matchesAnyPrefix(modelId, [
      "claude-sonnet-4-6",
      "claude-sonnet-4.6",
      "claude-opus-4-5",
      "claude-opus-4.5",
      "claude-sonnet-4-5",
      "claude-sonnet-4.5",
    ])
  ) {
    return {
      levels: [
        { id: "off" },
        { id: "minimal" },
        { id: "low" },
        { id: "medium" },
        { id: "high" },
        { id: "adaptive" },
      ],
      defaultLevel: "adaptive",
    };
  }
  return null;
}
