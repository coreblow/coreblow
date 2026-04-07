/**
 * CoreBlow — Hybrid Search v2
 *
 * Combines vector similarity and BM25 keyword scoring using either:
 *  - Reciprocal Rank Fusion (RRF) — default, rank-based, bias-free
 *  - Linear weight fusion — legacy, score-based
 *
 * Upgrades from v1:
 *  - Naive `includes()` → proper BM25 (TF-IDF saturation)
 *  - Linear-only fusion → RRF option (superiority over CoreBlow)
 *  - Query expansion integration
 */

import { cosineSimilarity } from './embeddings.js';
import { BM25Index } from './bm25.js';
import { fuseVectorAndKeyword, type RankedItem, type RRFResult } from './rrf.js';

// ─── Types ──────────────────────────────────────────────────────

export type FusionMode = 'rrf' | 'linear';

export interface HybridSearchConfig {
    /** Fusion method: 'rrf' (default, rank-based) or 'linear' (score-based) */
    fusionMode: FusionMode;
    /** Weight for vector similarity (linear mode only) */
    vectorWeight: number;
    /** Weight for keyword/BM25 score (linear mode only) */
    keywordWeight: number;
    /** RRF smoothing constant k (default: 60) */
    rrfK: number;
    /** Apply recency boost */
    recencyBoost: boolean;
    /** Max results to return */
    topK: number;
    /** Minimum score threshold */
    minScore: number;
    /** BM25 config overrides */
    bm25?: { k1?: number; b?: number };
}

export interface MemEntry {
    id: string;
    text: string;
    embedding: Float32Array | number[];
    metadata: {
        timestamp: number;
        importance: number;
        [k: string]: unknown;
    };
}

export interface HybridResult {
    entry: MemEntry;
    score: number;
    vectorScore: number;
    keywordScore: number;
    fusionMode: FusionMode;
}

// ─── Default Config ─────────────────────────────────────────────

const DEFAULT_CONFIG: HybridSearchConfig = {
    fusionMode: 'rrf',
    vectorWeight: 0.6,
    keywordWeight: 0.3,
    rrfK: 60,
    recencyBoost: false,
    topK: 10,
    minScore: 0,
};

// ─── Hybrid Search Engine ───────────────────────────────────────

export class HybridSearch {
    private config: HybridSearchConfig;
    private bm25Index: BM25Index;

    constructor(config?: Partial<HybridSearchConfig>) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.bm25Index = new BM25Index(this.config.bm25);
    }

    /**
     * Build the BM25 index from a set of entries.
     * Call this before search(), or whenever documents change.
     */
    buildIndex(entries: MemEntry[]): void {
        this.bm25Index.clear();
        for (const entry of entries) {
            this.bm25Index.addDocument(entry.id, entry.text);
        }
    }

    /**
     * Search entries using hybrid vector + BM25 scoring.
     */
    search(
        entries: MemEntry[],
        queryEmbedding: Float32Array | number[],
        queryText: string,
    ): HybridResult[] {
        // Ensure BM25 index is built
        if (this.bm25Index.stats().documents === 0) {
            this.buildIndex(entries);
        }

        if (this.config.fusionMode === 'rrf') {
            return this.searchRRF(entries, queryEmbedding, queryText);
        }
        return this.searchLinear(entries, queryEmbedding, queryText);
    }

    /**
     * RRF-based hybrid search (default).
     * Fuses vector and keyword rankings using Reciprocal Rank Fusion.
     */
    private searchRRF(
        entries: MemEntry[],
        queryEmbedding: Float32Array | number[],
        queryText: string,
    ): HybridResult[] {
        const entryMap = new Map(entries.map(e => [e.id, e]));

        // Rank by vector similarity
        const vectorScores = new Map<string, number>();
        const vectorRanked: RankedItem[] = entries
            .map(entry => {
                const score = cosineSimilarity(queryEmbedding, entry.embedding);
                vectorScores.set(entry.id, score);
                return { id: entry.id, score };
            })
            .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

        // Rank by BM25
        const bm25Results = this.bm25Index.search(queryText, entries.length);
        const keywordScores = new Map(bm25Results.map((r: { id: string; score: number }) => [r.id, r.score]));
        const keywordRanked: RankedItem[] = bm25Results;

        // Fuse with RRF
        const fused = fuseVectorAndKeyword(vectorScores, keywordScores, this.config.rrfK);

        // Map back to entries with scores
        let results: HybridResult[] = fused
            .map(f => {
                const entry = entryMap.get(f.id);
                if (!entry) return null;
                return {
                    entry,
                    score: f.score,
                    vectorScore: vectorScores.get(f.id) ?? 0,
                    keywordScore: keywordScores.get(f.id) ?? 0,
                    fusionMode: 'rrf' as FusionMode,
                };
            })
            .filter((r): r is HybridResult => r !== null);

        // Apply importance + recency boost
        results = this.applyBoosts(results);

        return results
            .filter((r: { score: number }) => r.score >= this.config.minScore)
            .slice(0, this.config.topK);
    }

    /**
     * Linear weight hybrid search (legacy, compatible with CoreBlow pattern).
     */
    private searchLinear(
        entries: MemEntry[],
        queryEmbedding: Float32Array | number[],
        queryText: string,
    ): HybridResult[] {
        let results: HybridResult[] = entries.map(entry => {
            const vectorScore = cosineSimilarity(queryEmbedding, entry.embedding);
            const keywordScore = this.bm25Index.scoreDocument(entry.id, queryText);

            // Normalize BM25 score to [0,1] range for linear combination
            const maxBM25 = Math.max(1, ...entries.map(e => this.bm25Index.scoreDocument(e.id, queryText)));
            const normalizedKeyword = maxBM25 > 0 ? keywordScore / maxBM25 : 0;

            const score = vectorScore * this.config.vectorWeight + normalizedKeyword * this.config.keywordWeight;

            return {
                entry,
                score,
                vectorScore,
                keywordScore,
                fusionMode: 'linear' as FusionMode,
            };
        });

        results = this.applyBoosts(results);

        return results
            .filter((r: { score: number }) => r.score >= this.config.minScore)
            .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
            .slice(0, this.config.topK);
    }

    /**
     * Apply importance and recency boosts to results.
     */
    private applyBoosts(results: HybridResult[]): HybridResult[] {
        return results.map((r: HybridResult) => {
            let boostedScore = r.score + r.entry.metadata.importance * 0.1;

            if (this.config.recencyBoost) {
                const ageMs = Date.now() - r.entry.metadata.timestamp;
                const ageDays = ageMs / (1000 * 60 * 60 * 24);
                // Decay over 90 days
                boostedScore += Math.max(0, 0.05 * (1 - ageDays / 90));
            }

            return { ...r, score: boostedScore };
        });
    }

    /**
     * Get BM25 index statistics.
     */
    getStats() {
        return {
            fusionMode: this.config.fusionMode,
            bm25: this.bm25Index.stats(),
        };
    }
}
