import type { AuthProfileStore } from "../agents/auth-profiles/types.js";

type LiveProviderModelConfig =
  | string
  | {
      primary?: string;
      fallbacks?: readonly string[];
    }
  | undefined;

function normalizeOptionalLowercaseString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : undefined;
}

export function redactLiveApiKey(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "none";
  }
  return trimmed.length <= 12 ? trimmed : `${trimmed.slice(0, 8)}...${trimmed.slice(-4)}`;
}

export function parseLiveCsvFilter(
  raw?: string,
  options: { lowercase?: boolean } = {},
): Set<string> | null {
  const trimmed = raw?.trim();
  if (!trimmed || trimmed === "all") {
    return null;
  }
  const values = trimmed
    .split(",")
    .map((entry) => (options.lowercase === false ? entry.trim() : entry.trim().toLowerCase()))
    .filter(Boolean);
  return values.length > 0 ? new Set(values) : null;
}

export function parseProviderModelMap(raw?: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const token of raw?.split(",") ?? []) {
    const trimmed = token.trim();
    const slash = trimmed.indexOf("/");
    if (slash <= 0 || slash === trimmed.length - 1) {
      continue;
    }
    const providerId = normalizeOptionalLowercaseString(trimmed.slice(0, slash));
    if (providerId) {
      entries.set(providerId, trimmed);
    }
  }
  return entries;
}

export function resolveConfiguredLiveProviderModels(
  configured: LiveProviderModelConfig,
): Map<string, string> {
  const resolved = new Map<string, string>();
  const add = (value: string | undefined) => {
    const trimmed = value?.trim();
    const slash = trimmed?.indexOf("/") ?? -1;
    if (!trimmed || slash <= 0 || slash === trimmed.length - 1) {
      return;
    }
    const providerId = normalizeOptionalLowercaseString(trimmed.slice(0, slash));
    if (providerId) {
      resolved.set(providerId, trimmed);
    }
  };
  if (typeof configured === "string") {
    add(configured);
    return resolved;
  }
  add(configured?.primary);
  for (const fallback of configured?.fallbacks ?? []) {
    add(fallback);
  }
  return resolved;
}

export function resolveLiveAuthStore(params: {
  requireProfileKeys: boolean;
  hasLiveKeys: boolean;
}): AuthProfileStore | undefined {
  return params.requireProfileKeys || !params.hasLiveKeys ? undefined : { version: 1, profiles: {} };
}
