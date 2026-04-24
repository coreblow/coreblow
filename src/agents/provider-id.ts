/**
 * agents/provider-id.ts
 * Provider ID normalization and resolution.
 * Ported from CoreBlow reference src/agents/provider-id.ts.
 */

/**
 * Normalize a provider ID to canonical form.
 * Preserves hyphens (e.g. "openai-codex" stays "openai-codex").
 * Only applies specific aliases for known edge cases.
 */
export function normalizeProviderId(provider: string): string {
  const normalized = provider.trim().toLowerCase();
  if (normalized === "z.ai" || normalized === "z-ai") {
    return "zai";
  }
  if (normalized === "opencode-zen") {
    return "opencode";
  }
  if (normalized === "opencode-go-auth") {
    return "opencode-go";
  }
  if (normalized === "kimi" || normalized === "kimi-code" || normalized === "kimi-coding") {
    return "kimi";
  }
  if (normalized === "bedrock" || normalized === "aws-bedrock") {
    return "amazon-bedrock";
  }
  // Backward compatibility for older provider naming.
  if (normalized === "bytedance" || normalized === "doubao") {
    return "volcengine";
  }
  return normalized;
}

/** Normalize provider ID for auth lookup. Coding-plan variants share auth with base. */
export function normalizeProviderIdForAuth(provider: string): string {
  const normalized = normalizeProviderId(provider);
  if (normalized === "volcengine-plan") {
    return "volcengine";
  }
  if (normalized === "byteplus-plan") {
    return "byteplus";
  }
  return normalized;
}

export function findNormalizedProviderValue<T>(
  entries: Record<string, T> | undefined,
  provider: string,
): T | undefined {
  if (!entries) {
    return undefined;
  }
  const providerKey = normalizeProviderId(provider);
  for (const [key, value] of Object.entries(entries)) {
    if (normalizeProviderId(key) === providerKey) {
      return value;
    }
  }
  return undefined;
}

export function findNormalizedProviderKey(
  entries: Record<string, unknown> | undefined,
  provider: string,
): string | undefined {
  if (!entries) {
    return undefined;
  }
  const providerKey = normalizeProviderId(provider);
  return Object.keys(entries).find((key) => normalizeProviderId(key) === providerKey);
}

/**
 * Parse a "provider/model" ref string.
 */
export function parseModelRef(ref: string): { provider: string; model: string } | null {
  const sep = ref.indexOf("/");
  if (sep < 0) return null;
  return { provider: normalizeProviderId(ref.slice(0, sep)), model: ref.slice(sep + 1) };
}

/**
 * Build a "provider/model" ref string.
 */
export function buildModelRef(provider: string, model: string): string {
  return `${normalizeProviderId(provider)}/${model}`;
}
