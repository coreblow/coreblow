/**
 * agents/provider-id.ts
 * Provider ID normalization and resolution.
 * Ported from CoreBlow reference src/agents/provider-id.ts.
 */

const PROVIDER_ALIASES: Record<string, string> = {
    oai: 'openai', openai: 'openai',
    anthropic: 'anthropic', claude: 'anthropic',
    google: 'google', gemini: 'google', vertex: 'google',
    deepseek: 'deepseek',
    groq: 'groq',
    mistral: 'mistral',
    together: 'together', togetherai: 'together',
    fireworks: 'fireworks',
    xai: 'xai', grok: 'xai',
    ollama: 'ollama', local: 'ollama',
    openrouter: 'openrouter',
    bedrock: 'amazon-bedrock', 'aws': 'amazon-bedrock', 'awsbedrock': 'amazon-bedrock', 'amazonbedrock': 'amazon-bedrock',
    azure: 'azure',
    cohere: 'cohere',
    // Kimi variants
    kimi: 'kimi', kimicode: 'kimi', kimicoding: 'kimi',
    // Z.ai variants — all normalize to 'zai'
    'z.ai': 'zai',
};

/**
 * Normalize a provider ID to canonical form.
 */
export function normalizeProviderId(raw: string): string {
    const lower = raw.trim().toLowerCase().replace(/[_\-\s]/g, '');
    return PROVIDER_ALIASES[lower] ?? lower;
}

/**
 * Normalize for auth profile lookups (some providers share auth).
 */
export function normalizeProviderIdForAuth(raw: string): string {
    // Strip "-plan" / "_plan" suffixes before normalizing —
    // volcengine-plan, openai-plan etc. share auth with their base provider.
    const base = raw.replace(/[-_]plan$/i, '');
    const normalized = normalizeProviderId(base);
    if (normalized === 'vertex') return 'google';
    return normalized;
}

/**
 * Find the canonical key in a config map.
 */
export function findNormalizedProviderKey(providers: Record<string, unknown> | undefined | null, raw: string): string | undefined {
    if (!providers) return undefined;
    const normalized = normalizeProviderId(raw);
    for (const key of Object.keys(providers)) {
        if (normalizeProviderId(key) === normalized) return key;
    }
    return undefined;
}

/**
 * Find the value for a provider in a config map.
 */
export function findNormalizedProviderValue<T>(providers: Record<string, T> | undefined | null, raw: string): T | undefined {
    if (!providers) return undefined;
    const key = findNormalizedProviderKey(providers, raw);
    return key ? providers[key] : undefined;
}

/**
 * Parse a "provider/model" ref string.
 */
export function parseModelRef(ref: string): { provider: string; model: string } | null {
    const sep = ref.indexOf('/');
    if (sep < 0) return null;
    return { provider: normalizeProviderId(ref.slice(0, sep)), model: ref.slice(sep + 1) };
}

/**
 * Build a "provider/model" ref string.
 */
export function buildModelRef(provider: string, model: string): string {
    return `${normalizeProviderId(provider)}/${model}`;
}

/**
 * List all known providers.
 */
export function listKnownProviders(): string[] {
    return [...new Set(Object.values(PROVIDER_ALIASES))].sort();
}

/**
 * Check if a provider is known.
 */
export function isKnownProvider(raw: string): boolean {
    return normalizeProviderId(raw) in PROVIDER_ALIASES || Object.values(PROVIDER_ALIASES).includes(normalizeProviderId(raw));
}
