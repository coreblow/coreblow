/**
 * CoreBlow — Inverted Index
 *
 * Token-based inverted index for fast term lookup.
 * Supports tokenization, stopwords, and term frequency.
 */

/** Posting */
export interface Posting {
    docId: string;
    field: string;
    positions: number[];
    tf: number;
}

/**
 * CoreBlow Inverted Index
 */
export class InvertedIndex {
    private index = new Map<string, Posting[]>();
    private docCount = 0;
    private stopwords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or', 'it']);

    /**
     * Add a document to the index.
     */
    add(docId: string, field: string, text: string): void {
        const tokens = this.tokenize(text);
        this.docCount++;

        const termPositions = new Map<string, number[]>();
        tokens.forEach((token, pos) => {
            if (!termPositions.has(token)) termPositions.set(token, []);
            termPositions.get(token)!.push(pos);
        });

        for (const [term, positions] of Array.from(termPositions)) {
            if (!this.index.has(term)) this.index.set(term, []);
            this.index.get(term)!.push({ docId, field, positions, tf: positions.length / tokens.length });
        }
    }

    /**
     * Search for a term.
     */
    search(term: string): Posting[] {
        return this.index.get(term.toLowerCase()) ?? [];
    }

    /**
     * Search multiple terms (AND).
     */
    searchAll(terms: string[]): string[] {
        const normalized = terms.map((t) => t.toLowerCase());
        const docSets = normalized.map((t) => new Set(this.search(t).map((p) => p.docId)));
        if (docSets.length === 0) return [];

        let result = docSets[0]!;
        for (let i = 1; i < docSets.length; i++) {
            result = new Set(Array.from(result).filter((id) => docSets[i]!.has(id)));
        }
        return Array.from(result);
    }

    /**
     * Get IDF (inverse document frequency).
     */
    idf(term: string): number {
        const postings = this.search(term);
        if (postings.length === 0 || this.docCount === 0) return 0;
        return Math.log(this.docCount / postings.length);
    }

    /**
     * Get term count.
     */
    termCount(): number { return this.index.size; }

    /**
     * Add stopword.
     */
    addStopword(word: string): void { this.stopwords.add(word.toLowerCase()); }

    /** Doc count */
    getDocCount(): number { return this.docCount; }

    // === Private ===
    private tokenize(text: string): string[] {
        return text.toLowerCase().split(/\W+/).filter((t) => t.length > 1 && !this.stopwords.has(t));
    }
}
