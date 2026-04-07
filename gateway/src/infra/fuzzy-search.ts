/**
 * CoreBlow — Fuzzy Search
 *
 * Approximate string matching using Levenshtein
 * distance with configurable threshold and scoring.
 */

/** Fuzzy match */
export interface FuzzyMatch {
    value: string;
    score: number;
    distance: number;
    id?: string;
}

/**
 * CoreBlow Fuzzy Search
 */
export class FuzzySearch {
    private entries: Array<{ id: string; value: string }> = [];
    private maxDistance = 2;

    /**
     * Add an entry.
     */
    add(id: string, value: string): void { this.entries.push({ id, value }); }

    /**
     * Add many entries.
     */
    addMany(entries: Array<{ id: string; value: string }>): void { this.entries.push(...entries); }

    /**
     * Set max distance.
     */
    setMaxDistance(max: number): void { this.maxDistance = max; }

    /**
     * Search with fuzzy matching.
     */
    search(query: string, limit: number = 10): FuzzyMatch[] {
        const q = query.toLowerCase();
        const matches: FuzzyMatch[] = [];

        for (const entry of this.entries) {
            const val = entry.value.toLowerCase();

            // Exact contains
            if (val.includes(q)) {
                matches.push({ value: entry.value, score: 1, distance: 0, id: entry.id });
                continue;
            }

            // Levenshtein
            const distance = this.levenshtein(q, val.slice(0, q.length + this.maxDistance));
            if (distance <= this.maxDistance) {
                const score = 1 - (distance / Math.max(q.length, val.length));
                matches.push({ value: entry.value, score, distance, id: entry.id });
            }
        }

        matches.sort((a, b) => b.score - a.score);
        return matches.slice(0, limit);
    }

    /**
     * Get best match.
     */
    bestMatch(query: string): FuzzyMatch | null {
        const results = this.search(query, 1);
        return results[0] ?? null;
    }

    /** Count */
    count(): number { return this.entries.length; }

    // === Private ===
    private levenshtein(a: string, b: string): number {
        const matrix: number[][] = [];
        for (let i = 0; i <= a.length; i++) {
            matrix[i] = [i];
            for (let j = 1; j <= b.length; j++) {
                if (i === 0) { matrix[i]![j] = j; continue; }
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[i]![j] = Math.min(
                    matrix[i - 1]![j]! + 1,
                    matrix[i]![j - 1]! + 1,
                    matrix[i - 1]![j - 1]! + cost,
                );
            }
        }
        return matrix[a.length]![b.length]!;
    }
}
