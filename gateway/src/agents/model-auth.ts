/**
 * CoreBlow Model Authentication Engine
 *
 * Manages API key resolution, auth profile selection, and credential
 * validation for model providers. Supports per-provider auth, env var
 * fallbacks, and multi-profile configurations.
 *
 * Equivalent: CoreBlow src/agents/model-auth.ts (533 LOC)
 */

import { createChildLogger } from '../utils/logger.js';
import { normalizeProviderId, type ModelRef } from './model-selection.js';

const log = createChildLogger('model-auth');

// ─── Types ────────────────────────────────────────────────────────

export interface AuthProfile {
    id: string;
    name?: string;
    provider: string;
    apiKey: string;
    baseUrl?: string;
    orgId?: string;
    headers?: Record<string, string>;
    priority?: number;
    rateLimit?: {
        requestsPerMinute?: number;
        tokensPerMinute?: number;
    };
    metadata?: Record<string, unknown>;
}

export interface AuthResolution {
    profile: AuthProfile;
    source: 'config' | 'env' | 'default' | 'override';
}

export interface AuthValidationResult {
    valid: boolean;
    provider: string;
    errors: string[];
    warnings: string[];
}

export interface ProviderCredentials {
    apiKey: string;
    baseUrl?: string;
    orgId?: string;
    headers?: Record<string, string>;
}

// ─── Constants ────────────────────────────────────────────────────

const ENV_KEY_MAP: Record<string, string[]> = {
    openai: ['OPENAI_API_KEY'],
    anthropic: ['ANTHROPIC_API_KEY'],
    google: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    'google-vertex': ['GOOGLE_APPLICATION_CREDENTIALS'],
    xai: ['XAI_API_KEY', 'GROK_API_KEY'],
    openrouter: ['OPENROUTER_API_KEY'],
    deepseek: ['DEEPSEEK_API_KEY'],
    mistral: ['MISTRAL_API_KEY'],
    cohere: ['COHERE_API_KEY', 'CO_API_KEY'],
    groq: ['GROQ_API_KEY'],
    together: ['TOGETHER_API_KEY'],
    fireworks: ['FIREWORKS_API_KEY'],
    perplexity: ['PERPLEXITY_API_KEY'],
};

const DEFAULT_BASE_URLS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: 'https://api.anthropic.com',
    google: 'https://generativelanguage.googleapis.com',
    xai: 'https://api.x.ai/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    deepseek: 'https://api.deepseek.com/v1',
    mistral: 'https://api.mistral.ai/v1',
    cohere: 'https://api.cohere.ai/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.xyz/v1',
    fireworks: 'https://api.fireworks.ai/inference/v1',
    perplexity: 'https://api.perplexity.ai',
    ollama: 'http://localhost:11434/api',
};

// ─── Auth Profile Registry ────────────────────────────────────────

const profiles = new Map<string, AuthProfile>();

export function registerAuthProfile(profile: AuthProfile): void {
    const key = profileKey(profile.provider, profile.id);
    profiles.set(key, profile);
    log.debug({ profileId: profile.id, provider: profile.provider }, 'Auth profile registered');
}

export function getAuthProfile(provider: string, profileId: string): AuthProfile | undefined {
    return profiles.get(profileKey(provider, profileId));
}

export function listAuthProfiles(provider?: string): AuthProfile[] {
    const all = Array.from(profiles.values());
    if (!provider) return all;
    const normalized = normalizeProviderId(provider);
    return all.filter((p) => normalizeProviderId(p.provider) === normalized);
}

export function removeAuthProfile(provider: string, profileId: string): boolean {
    return profiles.delete(profileKey(provider, profileId));
}

export function clearAuthProfiles(): void {
    profiles.clear();
}

function profileKey(provider: string, id: string): string {
    return `${normalizeProviderId(provider)}:${id}`;
}

// ─── Auth Resolution ──────────────────────────────────────────────

/**
 * Resolve credentials for a model reference.
 * Priority: explicit override → registered profile → env var → error
 */
export function resolveAuth(
    ref: ModelRef,
    profileId?: string,
    override?: Partial<ProviderCredentials>,
): AuthResolution | null {
    const provider = normalizeProviderId(ref.provider);

    // 1. Explicit override
    if (override?.apiKey) {
        return {
            profile: {
                id: 'override',
                provider,
                apiKey: override.apiKey,
                baseUrl: override.baseUrl ?? DEFAULT_BASE_URLS[provider],
                orgId: override.orgId,
                headers: override.headers,
            },
            source: 'override',
        };
    }

    // 2. Named profile
    if (profileId) {
        const profile = getAuthProfile(provider, profileId);
        if (profile) {
            return { profile, source: 'config' };
        }
        log.warn({ provider, profileId }, 'Auth profile not found');
    }

    // 3. Default profile (highest priority registered)
    const providerProfiles = listAuthProfiles(provider)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    if (providerProfiles.length > 0) {
        return { profile: providerProfiles[0]!, source: 'config' };
    }

    // 4. Environment variable fallback
    const envKey = resolveEnvApiKey(provider);
    if (envKey) {
        return {
            profile: {
                id: 'env',
                provider,
                apiKey: envKey,
                baseUrl: DEFAULT_BASE_URLS[provider],
            },
            source: 'env',
        };
    }

    // 5. For local providers (ollama), no key needed
    if (provider === 'ollama') {
        return {
            profile: {
                id: 'default',
                provider,
                apiKey: '',
                baseUrl: DEFAULT_BASE_URLS[provider],
            },
            source: 'default',
        };
    }

    log.warn({ provider }, 'No credentials found for provider');
    return null;
}

/**
 * Resolve API key from environment variables
 */
export function resolveEnvApiKey(provider: string): string | undefined {
    const normalized = normalizeProviderId(provider);
    const envKeys = ENV_KEY_MAP[normalized];
    if (!envKeys) return undefined;

    for (const key of envKeys) {
        const value = process.env[key];
        if (value?.trim()) return value.trim();
    }
    return undefined;
}

/**
 * Get the default base URL for a provider
 */
export function getDefaultBaseUrl(provider: string): string | undefined {
    return DEFAULT_BASE_URLS[normalizeProviderId(provider)];
}

/**
 * Check if a provider has any configured credentials
 */
export function hasCredentials(provider: string): boolean {
    const normalized = normalizeProviderId(provider);
    // Check profiles
    if (listAuthProfiles(normalized).length > 0) return true;
    // Check env
    if (resolveEnvApiKey(normalized)) return true;
    // Local providers
    if (normalized === 'ollama') return true;
    return false;
}

// ─── Validation ───────────────────────────────────────────────────

/**
 * Validate provider credentials
 */
export function validateAuth(provider: string, credentials: ProviderCredentials): AuthValidationResult {
    const normalized = normalizeProviderId(provider);
    const errors: string[] = [];
    const warnings: string[] = [];

    // API key validation
    if (!credentials.apiKey && normalized !== 'ollama') {
        errors.push(`Missing API key for provider "${normalized}"`);
    }

    if (credentials.apiKey) {
        // Check for obviously invalid keys
        if (credentials.apiKey.length < 10) {
            warnings.push('API key seems too short');
        }
        if (credentials.apiKey.includes(' ')) {
            errors.push('API key contains spaces');
        }

        // Provider-specific validation
        if (normalized === 'openai' && !credentials.apiKey.startsWith('sk-')) {
            warnings.push('OpenAI API key typically starts with "sk-"');
        }
        if (normalized === 'anthropic' && !credentials.apiKey.startsWith('sk-ant-')) {
            warnings.push('Anthropic API key typically starts with "sk-ant-"');
        }
    }

    // Base URL validation
    if (credentials.baseUrl) {
        try {
            new URL(credentials.baseUrl);
        } catch {
            errors.push(`Invalid base URL: "${credentials.baseUrl}"`);
        }
    }

    return {
        valid: errors.length === 0,
        provider: normalized,
        errors,
        warnings,
    };
}

// ─── Credential Masking ───────────────────────────────────────────

/**
 * Mask an API key for safe logging
 */
export function maskApiKey(key: string): string {
    if (!key || key.length < 8) return '***';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

/**
 * Check if an API key is masked
 */
export function isApiKeyMasked(key: string): boolean {
    return key.includes('...');
}

// ─── Provider Discovery ──────────────────────────────────────────

/**
 * Discover all providers with configured credentials
 */
export function discoverConfiguredProviders(): Array<{
    provider: string;
    source: 'config' | 'env';
    profileCount: number;
}> {
    const result: Array<{
        provider: string;
        source: 'config' | 'env';
        profileCount: number;
    }> = [];

    // From registered profiles
    const providerCounts = new Map<string, number>();
    for (const profile of profiles.values()) {
        const normalized = normalizeProviderId(profile.provider);
        providerCounts.set(normalized, (providerCounts.get(normalized) ?? 0) + 1);
    }
    for (const [provider, count] of providerCounts) {
        result.push({ provider, source: 'config', profileCount: count });
    }

    // From env vars (if not already in profiles)
    for (const provider of Object.keys(ENV_KEY_MAP)) {
        if (providerCounts.has(provider)) continue;
        if (resolveEnvApiKey(provider)) {
            result.push({ provider, source: 'env', profileCount: 0 });
        }
    }

    return result;
}
