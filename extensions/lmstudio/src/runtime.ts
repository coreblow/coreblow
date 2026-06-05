import type { CoreBlowConfig } from "coreblow/plugin-sdk/provider-auth";
import {
  CUSTOM_LOCAL_AUTH_MARKER,
  isKnownEnvApiKeyMarker,
  isNonSecretApiKeyMarker,
  normalizeOptionalSecretInput,
} from "coreblow/plugin-sdk/provider-auth";
import { resolveApiKeyForProvider } from "coreblow/plugin-sdk/provider-auth-runtime";
import {
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
} from "coreblow/plugin-sdk/secret-input";
import {
  LMSTUDIO_DEFAULT_API_KEY_ENV_VAR,
  LMSTUDIO_LOCAL_API_KEY_PLACEHOLDER,
  LMSTUDIO_PROVIDER_ID,
} from "./defaults.js";
import { hasLmstudioAuthorizationHeader } from "./provider-auth.js";

type LmstudioAuthHeadersParams = {
  apiKey?: string;
  json?: boolean;
  headers?: Record<string, string>;
};

function normalizeApiKeyConfig(value: string): string {
  const trimmed = value.trim();
  const match = /^\$\{([A-Z0-9_]+)\}$/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

export function buildLmstudioAuthHeaders(
  params: LmstudioAuthHeadersParams,
): Record<string, string> | undefined {
  const headers: Record<string, string> = { ...params.headers };
  const apiKey = params.apiKey?.trim();
  const isSyntheticLocalKey = apiKey === LMSTUDIO_LOCAL_API_KEY_PLACEHOLDER;
  if (apiKey && !isSyntheticLocalKey && !isNonSecretApiKeyMarker(apiKey)) {
    for (const headerName of Object.keys(headers)) {
      if (headerName.toLowerCase() === "authorization") {
        delete headers[headerName];
      }
    }
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (params.json) {
    headers["Content-Type"] = "application/json";
  }
  return Object.keys(headers).length > 0 ? headers : undefined;
}

function sanitizeStringHeaders(headers: unknown): Record<string, string> | undefined {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return undefined;
  }
  const next: Record<string, string> = {};
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (typeof headerValue !== "string") {
      continue;
    }
    const normalized = headerValue.trim();
    if (normalized) {
      next[headerName] = normalized;
    }
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

function resolveEnvTemplateApiKey(value: string, env: NodeJS.ProcessEnv): string | undefined {
  const normalized = normalizeApiKeyConfig(value);
  if (normalized === LMSTUDIO_DEFAULT_API_KEY_ENV_VAR || isKnownEnvApiKeyMarker(normalized)) {
    return normalizeOptionalSecretInput(env[normalized]);
  }
  return isNonSecretApiKeyMarker(normalized) ? undefined : normalized;
}

function resolveConfiguredSecretInputString(params: {
  value: unknown;
  env: NodeJS.ProcessEnv;
}): string | undefined {
  if (!hasConfiguredSecretInput(params.value)) {
    return undefined;
  }
  return normalizeResolvedSecretInputString({
    value: params.value,
    path: "models.providers.lmstudio.apiKey",
  });
}

export async function resolveLmstudioConfiguredApiKey(params: {
  config?: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
}): Promise<string | undefined> {
  const providerConfig = params.config?.models?.providers?.[LMSTUDIO_PROVIDER_ID];
  const apiKeyInput = providerConfig?.apiKey;
  if (apiKeyInput === undefined || apiKeyInput === null) {
    return undefined;
  }
  const env = params.env ?? process.env;
  const directApiKey = normalizeOptionalSecretInput(apiKeyInput);
  if (directApiKey !== undefined) {
    return resolveEnvTemplateApiKey(directApiKey, env);
  }
  const resolved = resolveConfiguredSecretInputString({ value: apiKeyInput, env });
  const normalized = resolved ? normalizeApiKeyConfig(resolved).trim() : "";
  return normalized && !isNonSecretApiKeyMarker(normalized) ? normalized : undefined;
}

export async function resolveLmstudioProviderHeaders(params: {
  config?: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
  headers?: unknown;
}): Promise<Record<string, string> | undefined> {
  return sanitizeStringHeaders(params.headers);
}

function shouldSuppressResolvedRuntimeApiKeyForHeaderAuth(
  source: string | undefined,
  hasAuthorizationHeader: boolean,
): boolean {
  if (!hasAuthorizationHeader || !source) {
    return false;
  }
  return /^profile:|^(?:shell )?env(?::|$)/u.test(source);
}

export async function resolveLmstudioRuntimeApiKey(params: {
  config?: CoreBlowConfig;
  agentDir?: string;
  env?: NodeJS.ProcessEnv;
  headers?: unknown;
}): Promise<string | undefined> {
  const config = params.config;
  if (!config) {
    return undefined;
  }
  const providerHeaders =
    params.headers ?? config.models?.providers?.[LMSTUDIO_PROVIDER_ID]?.headers;
  const hasAuthorizationHeader = hasLmstudioAuthorizationHeader(providerHeaders);
  const resolveConfiguredApiKeyOrThrow = async () => {
    const configuredApiKey = await resolveLmstudioConfiguredApiKey({
      config,
      env: params.env,
    });
    if (configuredApiKey) {
      return configuredApiKey;
    }
    if (hasAuthorizationHeader) {
      return undefined;
    }
    throw new Error(
      [
        "LM Studio API key is required.",
        `Set models.providers.lmstudio.apiKey (for example "\${${LMSTUDIO_DEFAULT_API_KEY_ENV_VAR}}")`,
        'or configure an Authorization header for the LM Studio endpoint.',
      ].join(" "),
    );
  };

  let resolved: Awaited<ReturnType<typeof resolveApiKeyForProvider>>;
  try {
    resolved = await resolveApiKeyForProvider({
      provider: LMSTUDIO_PROVIDER_ID,
      cfg: config,
      agentDir: params.agentDir,
    });
  } catch {
    return await resolveConfiguredApiKeyOrThrow();
  }
  const resolvedApiKey = resolved.apiKey?.trim();
  if (!resolvedApiKey) {
    return await resolveConfiguredApiKeyOrThrow();
  }
  if (shouldSuppressResolvedRuntimeApiKeyForHeaderAuth(resolved.source, hasAuthorizationHeader)) {
    return await resolveConfiguredApiKeyOrThrow();
  }
  if (
    isNonSecretApiKeyMarker(resolvedApiKey) &&
    resolvedApiKey !== CUSTOM_LOCAL_AUTH_MARKER &&
    resolvedApiKey !== LMSTUDIO_LOCAL_API_KEY_PLACEHOLDER
  ) {
    return await resolveConfiguredApiKeyOrThrow();
  }
  return resolvedApiKey;
}

export async function resolveLmstudioRequestContext(params: {
  config?: CoreBlowConfig;
  agentDir?: string;
  env?: NodeJS.ProcessEnv;
  providerHeaders?: unknown;
}): Promise<{ apiKey: string | undefined; headers: Record<string, string> | undefined }> {
  const providerHeaders =
    params.providerHeaders ?? params.config?.models?.providers?.[LMSTUDIO_PROVIDER_ID]?.headers;
  const [apiKey, headers] = await Promise.all([
    resolveLmstudioRuntimeApiKey({
      config: params.config,
      agentDir: params.agentDir,
      env: params.env,
      headers: providerHeaders,
    }),
    resolveLmstudioProviderHeaders({
      config: params.config,
      env: params.env,
      headers: providerHeaders,
    }),
  ]);
  return { apiKey, headers };
}
