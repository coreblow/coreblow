import { resolveProviderCacheTtlEligibility } from "../../plugins/provider-runtime.js";

type CustomEntryLike = { type?: unknown; customType?: unknown; data?: unknown };

export const CACHE_TTL_CUSTOM_TYPE = "coreblow.cache-ttl";

export type CacheTtlEntryData = {
  timestamp: number;
  provider?: string;
  modelId?: string;
};

/** Providers that natively support Anthropic-style cache-TTL headers. */
const NATIVE_CACHE_TTL_PROVIDERS = new Set(["anthropic", "moonshot", "zai"]);

/** OpenRouter upstream prefixes known to support cache-TTL pass-through. */
const OPENROUTER_CACHE_TTL_PREFIXES = ["anthropic/", "moonshot/", "moonshotai/", "zai/"];

export function isCacheTtlEligibleProvider(provider: string, modelId: string): boolean {
  const normalizedProvider = provider.toLowerCase();
  const normalizedModelId = modelId.toLowerCase();
  // Check plugin overrides first (extensions can register additional providers).
  const pluginEligibility = resolveProviderCacheTtlEligibility({
    provider: normalizedProvider,
    context: {
      provider: normalizedProvider,
      modelId: normalizedModelId,
    },
  });
  if (pluginEligibility !== undefined) {
    return pluginEligibility;
  }
  // Built-in eligibility for well-known cache-TTL providers.
  if (NATIVE_CACHE_TTL_PROVIDERS.has(normalizedProvider)) {
    return true;
  }
  if (
    normalizedProvider === "openrouter" &&
    OPENROUTER_CACHE_TTL_PREFIXES.some((prefix) => normalizedModelId.startsWith(prefix))
  ) {
    return true;
  }
  return false;
}

export function readLastCacheTtlTimestamp(sessionManager: unknown): number | null {
  const sm = sessionManager as { getEntries?: () => CustomEntryLike[] };
  if (!sm?.getEntries) {
    return null;
  }
  try {
    const entries = sm.getEntries();
    let last: number | null = null;
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry?.type !== "custom" || entry?.customType !== CACHE_TTL_CUSTOM_TYPE) {
        continue;
      }
      const data = entry?.data as Partial<CacheTtlEntryData> | undefined;
      const ts = typeof data?.timestamp === "number" ? data.timestamp : null;
      if (ts && Number.isFinite(ts)) {
        last = ts;
        break;
      }
    }
    return last;
  } catch {
    return null;
  }
}

export function appendCacheTtlTimestamp(sessionManager: unknown, data: CacheTtlEntryData): void {
  const sm = sessionManager as {
    appendCustomEntry?: (customType: string, data: unknown) => void;
  };
  if (!sm?.appendCustomEntry) {
    return;
  }
  try {
    sm.appendCustomEntry(CACHE_TTL_CUSTOM_TYPE, data);
  } catch {
    // ignore persistence failures
  }
}
