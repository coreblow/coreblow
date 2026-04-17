/**
 * web-search/runtime.ts
 * Web search runtime — resolves and executes web search queries via providers.
 */

import type { WebSearchProviderEntry, WebSearchResult, ResolveWebSearchParams, RunWebSearchParams } from './types.js';

const providers = new Map<string, WebSearchProviderEntry>();

export function registerWebSearchProvider(provider: WebSearchProviderEntry): void {
    providers.set(provider.id, provider);
}

export function getWebSearchProvider(id: string): WebSearchProviderEntry | undefined {
    return providers.get(id);
}

export function listWebSearchProviders(): WebSearchProviderEntry[] {
    return [...providers.values()];
}

export function resolveWebSearchProvider(params?: ResolveWebSearchParams): WebSearchProviderEntry | null {
    if (params?.providerId) return providers.get(params.providerId) ?? null;
    // Return first available provider by priority
    const sorted = [...providers.values()].sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
    return sorted[0] ?? null;
}

export async function runWebSearch(params: RunWebSearchParams): Promise<WebSearchResult | null> {
    const provider = resolveWebSearchProvider(params);
    if (!provider) return null;
    const tool = provider.createTool({
        config: params.config,
        searchConfig: params.config,
    });
    if (!tool) return null;
    const result = await tool.execute(params.args);
    return { provider: provider.id, result };
}

export function clearWebSearchProviders(): void {
    providers.clear();
}
