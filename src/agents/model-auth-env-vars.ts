import {
  PROVIDER_AUTH_ENV_VAR_CANDIDATES,
  listKnownProviderAuthEnvVarNames,
} from "../secrets/provider-env-vars.js";

export const PROVIDER_ENV_API_KEY_CANDIDATES = PROVIDER_AUTH_ENV_VAR_CANDIDATES;

export function listKnownProviderEnvApiKeyNames(): string[] {
  return listKnownProviderAuthEnvVarNames();
}

// Stub — used by gateway/startup-auth-profiles.ts
export const AUTH_ENV_VARS: Record<string, string[]> = {};
