// @ts-nocheck
/**
 * context-engine/context-search.ts
 * Search conversation context — find relevant past messages.
 */

import type { ContextEntry, ContextSearchResult } from './types.js';

/** Simple keyword search through context entries. */
export function searchContext(entries: ContextEntry[], query: string, topK = 5): ContextSearchResult[] {
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

    const scored: ContextSearchResult[] = entries.map((entry, index) => {
        const contentLower = entry.content.toLowerCase();
        let score = 0;

        // Exact phrase match (highest)
        if (contentLower.includes(queryLower)) {
            score += 10;
        }

        // Individual term matches
        for (const term of queryTerms) {
            if (contentLower.includes(term)) score += 2;
        }

        // Recency boost (newer = higher)
        score += (index / entries.length) * 1;

        // Role boost — assistant messages are more valuable for search
        if (entry.role === 'assistant') score += 0.5;

        return { entry, score, index };
    });

    return scored
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}

/** Find the last N messages from a specific role. */
export function findByRole(entries: ContextEntry[], role: string, limit = 10): ContextEntry[] {
    return entries.filter(e => e.role === role).slice(-limit);
}

/** Find tool call results in context. */
export function findToolResults(entries: ContextEntry[]): ContextEntry[] {
    return entries.filter(e => e.role === 'tool');
}

/** Calculate context statistics. */
export function contextStats(entries: ContextEntry[]): {
    total: number;
    byRole: Record<string, number>;
    totalTokens: number;
    avgTokensPerMessage: number;
} {
    const byRole: Record<string, number> = {};
    let totalTokens = 0;

    for (const entry of entries) {
        byRole[entry.role] = (byRole[entry.role] ?? 0) + 1;
        totalTokens += entry.tokens;
    }

    return {
        total: entries.length,
        byRole,
        totalTokens,
        avgTokensPerMessage: entries.length > 0 ? Math.round(totalTokens / entries.length) : 0,
    };
}
