import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { resolveProviderBuiltInModelSuppression } from "../plugins/provider-runtime.js";
import { normalizeProviderId } from "./provider-id.js";

const suppressionCache = new Map<string, ReturnType<typeof resolveProviderBuiltInModelSuppression>>();

export function resetModelSuppressionCacheForTest(): void {
  suppressionCache.clear();
}

function resolveBuiltInModelSuppression(params: {
  provider?: string | null;
  id?: string | null;
  baseUrl?: string | null;
  config?: CoreBlowConfig;
}) {
  const provider = normalizeProviderId(params.provider?.trim().toLowerCase() ?? "");
  const modelId = params.id?.trim().toLowerCase() ?? "";
  if (!provider || !modelId) {
    return undefined;
  }
  const cacheKey = `${provider}::${modelId}`;
  if (suppressionCache.has(cacheKey)) {
    return suppressionCache.get(cacheKey);
  }
  const result = resolveProviderBuiltInModelSuppression({
    env: process.env,
    context: {
      env: process.env,
      provider,
      modelId,
    },
  });
  suppressionCache.set(cacheKey, result);
  return result;
}

export function shouldSuppressBuiltInModel(params: {
  provider?: string | null;
  id?: string | null;
  baseUrl?: string | null;
  config?: CoreBlowConfig;
}) {
  return resolveBuiltInModelSuppression(params)?.suppress ?? false;
}

export function shouldSuppressBuiltInModelFromManifest(params: {
  provider?: string | null;
  id?: string | null;
  config?: CoreBlowConfig;
}) {
  return resolveBuiltInModelSuppression(params)?.suppress ?? false;
}

export function buildSuppressedBuiltInModelError(params: {
  provider?: string | null;
  id?: string | null;
}): string | undefined {
  return resolveBuiltInModelSuppression(params)?.errorMessage;
}
