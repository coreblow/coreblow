import type { ModelProviderConfig } from "coreblow/plugin-sdk/provider-model-shared";

export function readProviderBaseUrl(provider: ModelProviderConfig | undefined): string | undefined {
  if (!provider) {
    return undefined;
  }
  if (typeof provider.baseUrl === "string" && provider.baseUrl.trim()) {
    return provider.baseUrl.trim();
  }
  const alternate = provider as ModelProviderConfig & { baseURL?: unknown };
  return typeof alternate.baseURL === "string" && alternate.baseURL.trim()
    ? alternate.baseURL.trim()
    : undefined;
}
