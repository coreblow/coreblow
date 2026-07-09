import { normalizeProviderId } from "../../../types/provider-id.js";
import {
  resolveManifestDeprecatedProviderAuthChoice,
  type ProviderAuthChoiceMetadata,
} from "../../../plugins/provider-auth-choices.js";
import type { CoreBlowConfig } from "../../../config/config.js";

export const AUTH_PROFILE_RUNTIME_CONTRACT = {
  sessionId: "session-auth-contract",
  sessionKey: "agent:main:auth-contract",
  runId: "run-auth-contract",
  workspacePrompt: "continue with the bound Codex profile",
  openAiProvider: "openai",
  openAiCodexProvider: "openai-codex",
  codexCliProvider: "codex-cli",
  codexHarnessProvider: "codex",
  claudeCliProvider: "claude-cli",
  openAiProfileId: "openai:work",
  openAiCodexProfileId: "openai-codex:work",
  anthropicProfileId: "anthropic:work",
} as const;

/**
 * Resolve provider ID for auth lookup using CoreBlow's manifest deprecated choice map.
 * Equivalent to OpenClaw's resolveProviderIdForAuth but uses
 * resolveManifestDeprecatedProviderAuthChoice under the hood.
 */
export function resolveProviderIdForAuth(
  provider: string,
  params?: { config?: CoreBlowConfig; workspaceDir?: string },
): string {
  const normalized = normalizeProviderId(provider);
  if (!normalized) {
    return normalized;
  }
  const deprecatedMatch = resolveManifestDeprecatedProviderAuthChoice(normalized, params);
  if (deprecatedMatch) {
    return normalizeProviderId(deprecatedMatch.providerId);
  }
  return normalized;
}

export type ProviderAuthAliasLookupParams = {
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
};

export function createAuthAliasManifestRegistry(): {
  plugins: Array<{
    id: string;
    origin: string;
    providerAuthChoices?: Array<{
      provider: string;
      method: string;
      choiceId: string;
      deprecatedChoiceIds?: string[];
    }>;
  }>;
  diagnostics: unknown[];
} {
  return {
    plugins: [
      {
        id: "openai",
        origin: "bundled",
        providerAuthChoices: [
          {
            provider: AUTH_PROFILE_RUNTIME_CONTRACT.openAiCodexProvider,
            method: "oauth",
            choiceId: AUTH_PROFILE_RUNTIME_CONTRACT.openAiCodexProvider,
            deprecatedChoiceIds: [AUTH_PROFILE_RUNTIME_CONTRACT.codexCliProvider],
          },
        ],
      },
    ],
    diagnostics: [],
  };
}

export function expectedForwardedAuthProfile(params: {
  provider: string;
  authProfileProvider: string;
  aliasLookupParams?: ProviderAuthAliasLookupParams;
  sessionAuthProfileId: string | undefined;
}): string | undefined {
  return resolveProviderIdForAuth(params.provider, params.aliasLookupParams) ===
    resolveProviderIdForAuth(params.authProfileProvider, params.aliasLookupParams)
    ? params.sessionAuthProfileId
    : undefined;
}
