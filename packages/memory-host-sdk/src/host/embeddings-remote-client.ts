import { requireApiKey, resolveApiKeyForProvider, VERSION } from "./_core-imports.js";
import type { SsrFPolicy } from "./_core-imports.js";
import type { EmbeddingProviderOptions } from "./embeddings.js";
import { buildRemoteBaseUrlPolicy } from "./remote-http.js";
import { resolveMemorySecretInputString } from "./secret-input.js";
import { normalizeOptionalString } from "./string-utils.js";

export type RemoteEmbeddingProviderId = "openai" | "voyage" | "mistral";

function resolveCoreBlowAttributionHeaders(): Record<string, string> {
  const envVersion =
    typeof process !== "undefined"
      ? normalizeOptionalString(process.env.COREBLOW_VERSION)
      : undefined;
  const version = envVersion ?? VERSION;
  return {
    originator: "coreblow",
    version,
    "User-Agent": `coreblow/${version}`,
  };
}

function isNativeOpenAiEmbeddingRoute(provider: string, baseUrl: string): boolean {
  if (provider !== "openai") {
    return false;
  }
  try {
    return new URL(baseUrl).hostname.toLowerCase().replace(/\.+$/, "") === "api.openai.com";
  } catch {
    return false;
  }
}

export async function resolveRemoteEmbeddingBearerClient(params: {
  provider: RemoteEmbeddingProviderId;
  options: EmbeddingProviderOptions;
  defaultBaseUrl: string;
}): Promise<{ baseUrl: string; headers: Record<string, string>; ssrfPolicy?: SsrFPolicy }> {
  const remote = params.options.remote;
  const remoteApiKey = resolveMemorySecretInputString({
    value: remote?.apiKey,
    path: "agents.*.memorySearch.remote.apiKey",
  });
  const remoteBaseUrl = normalizeOptionalString(remote?.baseUrl);
  const providerConfig = params.options.config.models?.providers?.[params.provider];
  const apiKey = remoteApiKey
    ? remoteApiKey
    : requireApiKey(
        await resolveApiKeyForProvider({
          provider: params.provider,
          cfg: params.options.config,
          agentDir: params.options.agentDir,
        }),
        params.provider,
      );
  const baseUrl =
    remoteBaseUrl || normalizeOptionalString(providerConfig?.baseUrl) || params.defaultBaseUrl;
  const headerOverrides = Object.assign({}, providerConfig?.headers, remote?.headers);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    ...headerOverrides,
  };
  if (isNativeOpenAiEmbeddingRoute(params.provider, baseUrl)) {
    Object.assign(headers, resolveCoreBlowAttributionHeaders());
  }
  return { baseUrl, headers, ssrfPolicy: buildRemoteBaseUrlPolicy(baseUrl) };
}
