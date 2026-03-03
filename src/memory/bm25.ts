/**
 * CoreBlow — BM25 (Best Matching 25) Text Scoring Engine
 *
 * Production-grade BM25 implementation replacing the naive `includes()`
 * keyword matching in hybrid-search.ts.
 *
 * BM25 formula:
 *   score(D,Q) = Σ IDF(qi) · (tf(qi,D) · (k1+1)) / (tf(qi,D) + k1 · (1 - b + b · |D|/avgdl))
 *
 * Where:
 *   tf(qi,D) = term frequency of qi in document D
 *   IDF(qi)  = log((N - df(qi) + 0.5) / (df(qi) + 0.5) + 1)
 *   |D|      = document length (in terms)
 *   avgdl    = average document length
 *   k1       = term frequency saturation parameter (default 1.2)
 *   b        = document length normalization (default 0.75)
 *
 * @see Robertson & Zaragoza, "The Probabilistic Relevance Framework: BM25 and Beyond" (2009)
 */

// ─── Types ──────────────────────────────────────────────────────

export interface BM25Config {
    /** Term frequency saturation (default: 1.2) */
    k1: number;
    /** Document length normalization (default: 0.75) */
    b: number;
}

export interface BM25Result {
    id: string;
    score: number;
}

interface DocEntry {
    id: string;
    terms: string[];
    termFrequencies: Map<string, number>;
    length: number;
}

const DEFAULT_CONFIG: BM25Config = { k1: 1.2, b: 0.75 };

// ─── Stop Words ─────────────────────────────────────────────────

const STOP_WORDS = new Set([
    // English
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'it', 'its', 'this', 'that', 'i',
    // Indonesian
    'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk',
    'pada', 'adalah', 'tidak', 'akan', 'saya', 'dia', 'mereka',
]);

// ─── BM25 Index ─────────────────────────────────────────────────

export class BM25Index {
    private config: BM25Config;
    private documents: DocEntry[] = [];
    private docMap = new Map<string, DocEntry>();

    /** Inverted index: term → set of document IDs */
    private invertedIndex = new Map<string, Set<string>>();

    /** Total document count */
    private N = 0;

    /** Sum of all document lengths (for avgdl) */
    private totalLength = 0;

    constructor(config?: Partial<BM25Config>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    // ── Index Operations ──

    /**
     * Add a document to the index.
     */
    addDocument(id: string, text: string): void {
        if (this.docMap.has(id)) {
            this.removeDocument(id);
        }

        const terms = tokenize(text);
        const termFrequencies = new Map<string, number>();
        for (const term of terms) {
            termFrequencies.set(term, (termFrequencies.get(term) ?? 0) + 1);
        }

        const entry: DocEntry = { id, terms, termFrequencies, length: terms.length };
        this.documents.push(entry);
        this.docMap.set(id, entry);
        this.N++;
        this.totalLength += terms.length;

        // Update inverted index
        for (const term of termFrequencies.keys()) {
            if (!this.invertedIndex.has(term)) {
                this.invertedIndex.set(term, new Set());
            }
            this.invertedIndex.get(term)!.add(id);
        }
    }

    /**
     * Remove a document from the index.
     */
    removeDocument(id: string): boolean {
        const entry = this.docMap.get(id);
        if (!entry) return false;

        this.docMap.delete(id);
        this.documents = this.documents.filter(d => d.id !== id);
        this.N--;
        this.totalLength -= entry.length;

        // Update inverted index
        for (const term of entry.termFrequencies.keys()) {
            this.invertedIndex.get(term)?.delete(id);
            if (this.invertedIndex.get(term)?.size === 0) {
                this.invertedIndex.delete(term);
            }
        }
        return true;
    }

    /**
     * Bulk add documents.
     */
    addDocuments(docs: Array<{ id: string; text: string }>): void {
        for (const doc of docs) {
            this.addDocument(doc.id, doc.text);
        }
    }

    // ── Search ──

    /**
     * Search the index with a query string.
     * Returns documents ranked by BM25 score (highest first).
     */
    search(query: string, topK = 10): BM25Result[] {
        const queryTerms = tokenize(query);
        if (queryTerms.length === 0) return [];

        const avgdl = this.N > 0 ? this.totalLength / this.N : 1;
        const scores: BM25Result[] = [];

        for (const doc of this.documents) {
            let score = 0;
            for (const qt of queryTerms) {
                const tf = doc.termFrequencies.get(qt) ?? 0;
                if (tf === 0) continue;

                const idf = this.idf(qt);
                const numerator = tf * (this.config.k1 + 1);
                const denominator = tf + this.config.k1 * (1 - this.config.b + this.config.b * doc.length / avgdl);
                score += idf * (numerator / denominator);
            }
            if (score > 0) {
                scores.push({ id: doc.id, score });
            }
        }

        return scores.sort((a, b) => b.score - a.score).slice(0, topK);
    }

    /**
     * Get a single document's BM25 score for a query.
     */
    scoreDocument(docId: string, query: string): number {
        const doc = this.docMap.get(docId);
        if (!doc) return 0;

        const queryTerms = tokenize(query);
        const avgdl = this.N > 0 ? this.totalLength / this.N : 1;
        let score = 0;

        for (const qt of queryTerms) {
            const tf = doc.termFrequencies.get(qt) ?? 0;
            if (tf === 0) continue;
            const numerator = tf * (this.config.k1 + 1);
            const denominator = tf + this.config.k1 * (1 - this.config.b + this.config.b * doc.length / avgdl);
            score += this.idf(qt) * (numerator / denominator);
        }
        return score;
    }

    // ── Statistics ──

    /**
     * Inverse Document Frequency for a term.
     * IDF(t) = log((N - df(t) + 0.5) / (df(t) + 0.5) + 1)
     */
    idf(term: string): number {
        const df = this.invertedIndex.get(term)?.size ?? 0;
        return Math.log((this.N - df + 0.5) / (df + 0.5) + 1);
    }

    /**
     * Document frequency: how many documents contain the term.
     */
    df(term: string): number {
        return this.invertedIndex.get(term)?.size ?? 0;
    }

    /**
     * Get index stats.
     */
    stats(): { documents: number; terms: number; avgDocLength: number } {
        return {
            documents: this.N,
            terms: this.invertedIndex.size,
            avgDocLength: this.N > 0 ? this.totalLength / this.N : 0,
        };
    }

    /** Clear all indexed documents */
    clear(): void {
        this.documents = [];
        this.docMap.clear();
        this.invertedIndex.clear();
        this.N = 0;
        this.totalLength = 0;
    }
}

// ─── Tokenizer ──────────────────────────────────────────────────

/**
 * Tokenize text for BM25 scoring.
 * Lowercase, split on non-word chars, remove stop words & short tokens.
 */
export function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^\p{L}\p{N}_]+/u)
        .map(t => t.trim())
        .filter(t => t.length > 1 && !STOP_WORDS.has(t));
}
