/**
 * plugins/web-search-providers.shared.ts
 * Web search provider registry shared between plugins & tools.
 */

export type WebSearchProvider = {
    id: string;
    name: string;
    search: (query: string, options?: { maxResults?: number }) => Promise<WebSearchResult[]>;
};

export type WebSearchResult = {
    title: string;
    url: string;
    snippet: string;
    source: string;
};

const providers = new Map<string, WebSearchProvider>();

export function registerSearchProvider(provider: WebSearchProvider): void {
    providers.set(provider.id, provider);
}

export function getSearchProvider(id: string): WebSearchProvider | undefined {
    return providers.get(id);
}

export function listSearchProviders(): WebSearchProvider[] {
    return [...providers.values()];
}

export function resetSearchProviders(): void {
    providers.clear();
}
