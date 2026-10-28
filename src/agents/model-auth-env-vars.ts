import {
  PROVIDER_AUTH_ENV_VAR_CANDIDATES,
  listKnownProviderAuthEnvVarNames,
} from "../secrets/provider-env-vars.js";

export const PROVIDER_ENV_API_KEY_CANDIDATES = PROVIDER_AUTH_ENV_VAR_CANDIDATES;

export function resolveProviderEnvApiKeyCandidates(
  _params?: unknown,
): Record<string, readonly string[]> {
  return PROVIDER_ENV_API_KEY_CANDIDATES;
}

export function resolveProviderEnvAuthEvidence(
  _params?: unknown,
): Record<string, readonly unknown[]> {
  return {};
}

export function listProviderEnvAuthLookupKeys(params: {
  envCandidateMap: Readonly<Record<string, readonly string[]>>;
  authEvidenceMap?: Readonly<Record<string, readonly unknown[]>>;
}): string[] {
  return Array.from(
    new Set([...Object.keys(params.envCandidateMap), ...Object.keys(params.authEvidenceMap ?? {})]),
  ).sort((a, b) => a.localeCompare(b));
}

export function listKnownProviderEnvApiKeyNames(): string[] {
  return listKnownProviderAuthEnvVarNames();
}

// Stub — used by gateway/startup-auth-profiles.ts
export const AUTH_ENV_VARS: Record<string, string[]> = {};
