/**
 * memory/search.ts
 * Memory search — uses BM25 index for text-based similarity search.
 *
 * Replaces the stub with real BM25-based search using the existing
 * BM25Index implementation in bm25.ts.
 */

import { BM25Index } from './bm25.js';

export interface MemorySearchResult {
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
}

export interface MemorySearchOptions {
    topK?: number;
    threshold?: number;
    filter?: Record<string, unknown>;
}

// ─── In-Memory Search Index ────────────────────────────────────

const index = new BM25Index();
const entries = new Map<string, { content: string; metadata?: Record<string, unknown> }>();

/**
 * Index a memory entry for search.
 */
export function indexMemory(id: string, content: string, metadata?: Record<string, unknown>): void {
    index.addDocument(id, content);
    entries.set(id, { content, metadata });
}

/**
 * Remove a memory entry from the search index.
 */
export function removeMemory(id: string): boolean {
    index.removeDocument(id);
    return entries.delete(id);
}

/**
 * Search memory entries by text similarity (BM25).
 */
export async function searchMemory(
    query: string,
    options?: MemorySearchOptions,
): Promise<MemorySearchResult[]> {
    const topK = options?.topK ?? 10;
    const threshold = options?.threshold ?? 0;

    const results = index.search(query, topK);

    return results
        .filter((r) => r.score >= threshold)
        .map((r) => {
            const entry = entries.get(r.id);
            return {
                id: r.id,
                content: entry?.content ?? '',
                score: r.score,
                metadata: entry?.metadata,
            };
        })
        .filter((r) => {
            // Apply metadata filter if provided
            if (!options?.filter) return true;
            if (!r.metadata) return false;
            return Object.entries(options.filter).every(
                ([key, val]) => r.metadata![key] === val,
            );
        });
}

/**
 * Rank results by score (highest first).
 */
export function rankResults(results: MemorySearchResult[]): MemorySearchResult[] {
    return [...results].sort((a, b) => b.score - a.score);
}

/**
 * Get index statistics.
 */
export function getSearchStats(): { documents: number; terms: number; avgDocLength: number } {
    return index.stats();
}

/**
 * Clear all indexed memory.
 */
export function clearSearchIndex(): void {
    index.clear();
    entries.clear();
}
