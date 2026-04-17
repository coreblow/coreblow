/**
 * web-search/credential-resolver.ts
 * Resolve web search provider credentials from config and env vars.
 * Follows CoreBlow's credential resolution pattern.
 */

import type { WebSearchProviderEntry } from './types.js';

/** Normalize a secret input value — trim and check for empty. */
export function normalizeSecretInput(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

/** Read the first available env var value from a list. */
export function readProviderEnvValue(envVars: string[]): string | undefined {
    for (const envVar of envVars) {
        const value = normalizeSecretInput(process.env[envVar]);
        if (value) return value;
    }
    return undefined;
}

/** Check if a provider requires credentials. */
export function providerRequiresCredential(
    provider: Pick<WebSearchProviderEntry, 'requiresCredential'>,
): boolean {
    return provider.requiresCredential !== false;
}

/** Check if a provider entry has valid credentials available. */
export function hasProviderCredential(
    provider: Pick<WebSearchProviderEntry, 'credentialPath' | 'envVars' | 'getConfiguredCredentialValue' | 'getCredentialValue' | 'requiresCredential'>,
    config: Record<string, unknown> | undefined,
    searchConfig: Record<string, unknown> | undefined,
): boolean {
    if (!providerRequiresCredential(provider)) return true;

    // Check config-level credential
    const rawValue =
        provider.getConfiguredCredentialValue?.(config) ??
        provider.getCredentialValue(searchConfig);

    const fromConfig = normalizeSecretInput(rawValue as string | undefined);
    if (fromConfig) return true;

    // Check env var credential
    return Boolean(readProviderEnvValue(provider.envVars));
}
