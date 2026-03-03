/**
 * CoreBlow — Search Ranking
 *
 * Ranks search results using TF-IDF, freshness,
 * popularity, and custom boost factors.
 */

/** Rankable item */
export interface RankableItem {
    id: string;
    termFrequency: number;
    docFrequency: number;
    totalDocs: number;
    freshness?: number; // 0-1, 1 = newest
    popularity?: number; // 0-1
    boosts?: Record<string, number>;
}

/** Ranked result */
export interface RankedResult {
    id: string;
    score: number;
    components: Record<string, number>;
}

/**
 * CoreBlow Search Ranking
 */
export class SearchRanking {
    private weights = { tfidf: 1.0, freshness: 0.3, popularity: 0.2 };
    private customBoosts = new Map<string, number>();

    /**
     * Set weights.
     */
    setWeights(weights: Partial<typeof this.weights>): void {
        Object.assign(this.weights, weights);
    }

    /**
     * Add a custom boost factor.
     */
    addBoost(name: string, weight: number): void { this.customBoosts.set(name, weight); }

    /**
     * Rank items.
     */
    rank(items: RankableItem[]): RankedResult[] {
        const results: RankedResult[] = items.map((item) => {
            const components: Record<string, number> = {};

            // TF-IDF
            const tf = item.termFrequency;
            const idf = item.totalDocs > 0 && item.docFrequency > 0 ? Math.log(item.totalDocs / item.docFrequency) : 0;
            components.tfidf = tf * idf * this.weights.tfidf;

            // Freshness
            components.freshness = (item.freshness ?? 0) * this.weights.freshness;

            // Popularity
            components.popularity = (item.popularity ?? 0) * this.weights.popularity;

            // Custom boosts
            if (item.boosts) {
                for (const [name, value] of Object.entries(item.boosts)) {
                    const weight = this.customBoosts.get(name) ?? 1;
                    components[name] = value * weight;
                }
            }

            const score = Object.values(components).reduce((s, v) => s + v, 0);
            return { id: item.id, score, components };
        });

        results.sort((a, b) => b.score - a.score);
        return results;
    }

    /**
     * Get weights.
     */
    getWeights(): typeof this.weights { return { ...this.weights }; }
}
