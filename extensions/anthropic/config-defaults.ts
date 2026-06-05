import type { CoreBlowConfig } from "coreblow/plugin-sdk/provider-auth";
import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import { CLAUDE_CLI_BACKEND_ID } from "./cli-constants.js";

const ANTHROPIC_PROVIDER_API = "anthropic-messages";

function normalizeLowercaseStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isAnthropicProviderId(provider: string): boolean {
  const normalized = normalizeLowercaseStringOrEmpty(provider);
  return normalized === "anthropic" || normalized === CLAUDE_CLI_BACKEND_ID;
}

export function normalizeAnthropicProviderConfigForProvider(params: {
  provider: string;
  providerConfig: ModelProviderConfig;
}): ModelProviderConfig {
  if (!isAnthropicProviderId(params.provider)) {
    return params.providerConfig;
  }
  return {
    ...params.providerConfig,
    api: ANTHROPIC_PROVIDER_API,
  };
}

function hasAnthropicApiKeyProfile(config: CoreBlowConfig): boolean {
  return Object.values(config.auth?.profiles ?? {}).some(
    (profile) => profile?.provider === "anthropic" && profile?.mode === "api_key",
  );
}

export function applyAnthropicConfigDefaults(params: {
  config: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
}): CoreBlowConfig {
  const hasApiKey = hasAnthropicApiKeyProfile(params.config) || Boolean(params.env?.ANTHROPIC_API_KEY);
  if (!hasApiKey) {
    return params.config;
  }
  const defaults = params.config.agents?.defaults ?? {};
  return {
    ...params.config,
    agents: {
      ...params.config.agents,
      defaults: {
        ...defaults,
        contextPruning: defaults.contextPruning ?? {
          mode: "cache-ttl",
          ttl: "1h",
        },
        heartbeat: defaults.heartbeat ?? {
          every: "30m",
        },
      },
    },
  };
}
