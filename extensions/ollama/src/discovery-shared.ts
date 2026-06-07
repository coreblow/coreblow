import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";
import { OLLAMA_DEFAULT_BASE_URL } from "./defaults.js";
import { readProviderBaseUrl } from "./provider-base-url.js";
import { buildOllamaProvider, resolveOllamaApiBase } from "./provider-models.js";

export const OLLAMA_PROVIDER_ID = "ollama";
export const OLLAMA_DEFAULT_API_KEY = "ollama-local"; // pragma: allowlist secret

export type OllamaPluginConfig = {
  discovery?: {
    enabled?: boolean;
  };
};

type OllamaDiscoveryContext = {
  config: {
    models?: {
      providers?: Record<string, ModelProviderConfig | undefined>;
      ollamaDiscovery?: {
        enabled?: boolean;
      };
    };
  };
  env: NodeJS.ProcessEnv;
  resolveProviderApiKey: (providerId: string) => { apiKey?: unknown };
};

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    return normalizeOptionalString(value);
  }
  if (value && typeof value === "object" && "value" in value) {
    return normalizeOptionalString((value as { value?: unknown }).value);
  }
  return undefined;
}

function isIpv4Loopback(host: string): boolean {
  const octets = host.split(".").map((part) => Number.parseInt(part, 10));
  return octets.length === 4 && octets.every((part) => Number.isInteger(part)) && octets[0] === 127;
}

export function isLocalOllamaBaseUrl(baseUrl: string | undefined | null): boolean {
  if (!baseUrl) {
    return true;
  }
  try {
    const host = new URL(baseUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host === "::" ||
      host.endsWith(".local") ||
      isIpv4Loopback(host) ||
      !host.includes(".")
    );
  } catch {
    return false;
  }
}

export function shouldUseSyntheticOllamaAuth(
  providerConfig: ModelProviderConfig | undefined,
): boolean {
  if (!providerConfig) {
    return false;
  }
  const hasConfig =
    (Array.isArray(providerConfig.models) && providerConfig.models.length > 0) ||
    Boolean(readProviderBaseUrl(providerConfig)) ||
    Boolean(readStringValue(providerConfig.apiKey)) ||
    Boolean(providerConfig.auth) ||
    typeof providerConfig.authHeader === "boolean" ||
    Boolean((providerConfig as ModelProviderConfig & { request?: unknown }).request) ||
    typeof providerConfig.injectNumCtxForOpenAICompat === "boolean";
  return hasConfig && isLocalOllamaBaseUrl(readProviderBaseUrl(providerConfig));
}

export async function resolveOllamaDiscoveryResult(params: {
  ctx: OllamaDiscoveryContext;
  pluginConfig: OllamaPluginConfig;
  buildProvider?: (
    configuredBaseUrl?: string,
    opts?: { quiet?: boolean },
  ) => Promise<ModelProviderConfig>;
}): Promise<{ provider: ModelProviderConfig } | null> {
  if (params.pluginConfig.discovery?.enabled === false ||
    params.ctx.config.models?.ollamaDiscovery?.enabled === false) {
    return null;
  }
  const explicit = params.ctx.config.models?.providers?.ollama;
  const explicitBaseUrl = readProviderBaseUrl(explicit);
  const hasExplicitModels = Array.isArray(explicit?.models) && explicit.models.length > 0;
  const resolvedApiKey = params.ctx.resolveProviderApiKey(OLLAMA_PROVIDER_ID).apiKey;
  const apiKey =
    readStringValue(explicit?.apiKey) ??
    normalizeOptionalString(resolvedApiKey) ??
    (isLocalOllamaBaseUrl(explicitBaseUrl) ? OLLAMA_DEFAULT_API_KEY : undefined);

  if (hasExplicitModels && explicit) {
    return {
      provider: {
        ...explicit,
        baseUrl: explicitBaseUrl ? resolveOllamaApiBase(explicitBaseUrl) : OLLAMA_DEFAULT_BASE_URL,
        api: explicit.api ?? "ollama",
        apiKey: apiKey ?? explicit.apiKey,
      },
    };
  }

  const buildProvider = params.buildProvider ?? buildOllamaProvider;
  const provider = await buildProvider(explicitBaseUrl, { quiet: !apiKey && !explicit });
  if (provider.models.length === 0 && !apiKey && !explicit) {
    return null;
  }
  return { provider: { ...provider, apiKey: apiKey ?? explicit?.apiKey ?? OLLAMA_DEFAULT_API_KEY } };
}
