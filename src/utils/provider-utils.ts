import type { CoreBlowConfig } from "../config/config.js";
import type { ProviderRuntimeModel } from "../plugins/types.js";
import { resolveProviderReasoningOutputModeWithPlugin } from "../plugins/provider-runtime.js";

/**
 * Utility functions for provider-specific logic and capabilities.
 */

const defaultResolveProviderReasoningOutputModeWithPlugin =
  resolveProviderReasoningOutputModeWithPlugin;
const providerReasoningOutputModeDeps = {
  resolveProviderReasoningOutputModeWithPlugin:
    defaultResolveProviderReasoningOutputModeWithPlugin,
};

export function setProviderReasoningOutputModeResolverForTest(
  resolver?: typeof defaultResolveProviderReasoningOutputModeWithPlugin,
): void {
  providerReasoningOutputModeDeps.resolveProviderReasoningOutputModeWithPlugin =
    resolver ?? defaultResolveProviderReasoningOutputModeWithPlugin;
}

export function resolveReasoningOutputMode(params: {
  provider: string | undefined | null;
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  modelId?: string;
  modelApi?: string | null;
  model?: ProviderRuntimeModel;
}): "native" | "tagged" {
  const provider = params.provider?.trim();
  if (!provider) {
    return "native";
  }

  const pluginMode = providerReasoningOutputModeDeps.resolveProviderReasoningOutputModeWithPlugin({
    provider,
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
    context: {
      config: params.config,
      workspaceDir: params.workspaceDir,
      env: params.env,
      provider,
      modelId: params.modelId,
      modelApi: params.modelApi,
      model: params.model,
    },
  });
  if (pluginMode) {
    return pluginMode;
  }

  const normalized = provider.toLowerCase();
  if (
    normalized === "google" ||
    normalized === "google-gemini-cli" ||
    normalized === "google-generative-ai" ||
    normalized.includes("minimax")
  ) {
    return "tagged";
  }
  return "native";
}

/**
 * Returns true if the provider requires reasoning to be wrapped in tags
 * (e.g. <think> and <final>) in the text stream, rather than using native
 * API fields for reasoning/thinking.
 */
export function isReasoningTagProvider(
  provider: string | undefined | null,
  options?: Omit<Parameters<typeof resolveReasoningOutputMode>[0], "provider">,
): boolean {
  return resolveReasoningOutputMode({ provider, ...options }) === "tagged";
}
