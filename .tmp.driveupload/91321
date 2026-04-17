/**
 * agents/configured-provider-fallback.ts
 * Provider fallback chain configuration.
 */
import { normalizeProviderId } from './provider-id.js';

export interface ProviderFallbackConfig { primary: string; fallbacks: string[]; maxRetries?: number; }

export function resolveProviderChain(config: ProviderFallbackConfig): string[] {
    const chain = [normalizeProviderId(config.primary), ...config.fallbacks.map(normalizeProviderId)];
    return [...new Set(chain)];
}

export function nextProvider(chain: string[], current: string): string | null {
    const idx = chain.indexOf(normalizeProviderId(current));
    return idx >= 0 && idx < chain.length - 1 ? chain[idx + 1] : null;
}
