/**
 * CoreBlow — Search Engine
 *
 * Full-text search engine with document indexing,
 * querying, highlighting, and pagination.
 */

/** Searchable document */
export interface SearchDocument {
    id: string;
    fields: Record<string, string>;
    metadata?: Record<string, unknown>;
    indexedAt: number;
}

/** Search hit */
export interface SearchHit {
    id: string;
    score: number;
    highlights: Record<string, string>;
    document: SearchDocument;
}

/** Search result */
export interface SearchResult {
    hits: SearchHit[];
    total: number;
    took: number;
    page: number;
    pageSize: number;
}

/**
 * CoreBlow Search Engine
 */
export class SearchEngine {
    private documents = new Map<string, SearchDocument>();
    private fieldWeights: Record<string, number> = {};

    /**
     * Index a document.
     */
    index(id: string, fields: Record<string, string>, metadata?: Record<string, unknown>): void {
        this.documents.set(id, { id, fields, metadata, indexedAt: Date.now() });
    }

    /**
     * Set field weights for scoring.
     */
    setWeights(weights: Record<string, number>): void { this.fieldWeights = weights; }

    /**
     * Search documents.
     */
    search(query: string, page: number = 1, pageSize: number = 10): SearchResult {
        const start = Date.now();
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        const hits: SearchHit[] = [];

        for (const doc of Array.from(this.documents.values())) {
            let totalScore = 0;
            const highlights: Record<string, string> = {};

            for (const [field, value] of Object.entries(doc.fields)) {
                const lower = value.toLowerCase();
                const weight = this.fieldWeights[field] ?? 1;

                for (const term of terms) {
                    const idx = lower.indexOf(term);
                    if (idx !== -1) {
                        totalScore += weight;
                        const snippetStart = Math.max(0, idx - 20);
                        const snippetEnd = Math.min(value.length, idx + term.length + 20);
                        highlights[field] = `...${value.slice(snippetStart, idx)}<em>${value.slice(idx, idx + term.length)}</em>${value.slice(idx + term.length, snippetEnd)}...`;
                    }
                }
            }

            if (totalScore > 0) hits.push({ id: doc.id, score: totalScore, highlights, document: doc });
        }

        hits.sort((a, b) => b.score - a.score);
        const offset = (page - 1) * pageSize;
        return { hits: hits.slice(offset, offset + pageSize), total: hits.length, took: Date.now() - start, page, pageSize };
    }

    /**
     * Remove a document.
     */
    remove(id: string): boolean { return this.documents.delete(id); }

    /**
     * Get a document.
     */
    get(id: string): SearchDocument | null { return this.documents.get(id) ?? null; }

    /** Count */
    count(): number { return this.documents.size; }
}
