/**
 * src/tools/web_search.ts
 * Web search tool via Brave Search API or SearXNG
 */

import type { ToolHandler } from './types.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('tool:web_search');

export const webSearchTool: ToolHandler = {
    name: 'web_search',
    description: 'Search the web for information. Returns titles, URLs, and descriptions of top results.',
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: 'Search query',
            },
            count: {
                type: 'number',
                description: 'Number of results (1-10, default 5)',
            },
        },
        required: ['query'],
    },

    async execute(args: Record<string, any>): Promise<string> {
        const { query, count = 5 } = args;
        const numResults = Math.min(Math.max(1, count), 10);

        // Try Brave Search API first
        const braveKey = process.env.BRAVE_SEARCH_API_KEY;
        if (braveKey) {
            return await searchBrave(query, numResults, braveKey);
        }

        // Try SearXNG
        const searxngUrl = process.env.SEARXNG_URL;
        if (searxngUrl) {
            return await searchSearXNG(query, numResults, searxngUrl);
        }

        // Fallback: DuckDuckGo lite (no API key needed)
        return await searchDDGLite(query, numResults);
    },
};

async function searchBrave(query: string, count: number, apiKey: string): Promise<string> {
    try {
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
        const res = await fetch(url, {
            headers: { 'X-Subscription-Token': apiKey, Accept: 'application/json' },
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) return `Brave Search error: HTTP ${res.status}`;

        const data: any = await res.json();
        const results = data.web?.results || [];

        if (results.length === 0) return `No results found for: ${query}`;

        return results
            .slice(0, count)
            .map((r: any, i: number) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.description || ''}`)
            .join('\n\n');
    } catch (err: any) {
        return `Search error: ${err.message}`;
    }
}

async function searchSearXNG(query: string, count: number, baseUrl: string): Promise<string> {
    try {
        const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

        if (!res.ok) return `SearXNG error: HTTP ${res.status}`;

        const data: any = await res.json();
        const results = data.results || [];

        if (results.length === 0) return `No results found for: ${query}`;

        return results
            .slice(0, count)
            .map((r: any, i: number) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.content || ''}`)
            .join('\n\n');
    } catch (err: any) {
        return `Search error: ${err.message}`;
    }
}

async function searchDDGLite(query: string, count: number): Promise<string> {
    try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'CoreBlow-Gateway/1.0' },
            signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) return `Search error: HTTP ${res.status}`;

        const html = await res.text();

        // Extract results from DuckDuckGo HTML
        const results: string[] = [];
        const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>[\s\S]*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gi;
        let match;

        while ((match = resultRegex.exec(html)) !== null && results.length < count) {
            const href = decodeURIComponent(match[1].replace(/.*uddg=/, '').split('&')[0]);
            const title = match[2].replace(/<[^>]+>/g, '').trim();
            const snippet = match[3].replace(/<[^>]+>/g, '').trim();
            results.push(`${results.length + 1}. **${title}**\n   ${href}\n   ${snippet}`);
        }

        return results.length > 0
            ? results.join('\n\n')
            : `No results found for: ${query}`;
    } catch (err: any) {
        return `Search error: ${err.message}`;
    }
}
