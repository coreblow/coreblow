/**
 * memory/rrf.ts
 * Reciprocal Rank Fusion — merges vector and keyword search results.
 */


export function rrfFuse(results: Array<{ id: string; scores: number[] }>, k = 60): Array<{ id: string; score: number }> {
    return results.map(r => ({ id: r.id, score: r.scores.reduce((sum, s, i) => sum + 1 / (k + i + 1) * s, 0) })).sort((a, b) => b.score - a.score);
}


export interface RankedItem { id: string; score: number; }
export interface RRFResult { id: string; score: number; sources: string[]; }
export function fuseVectorAndKeyword(vectorScores: Map<string, number>, keywordScores: Map<string, number>, k = 60): RRFResult[] {
    const allIds = new Set([...vectorScores.keys(), ...keywordScores.keys()]);
    const results: RRFResult[] = [];
    for (const id of allIds) {
        const vs = vectorScores.get(id) ?? 0;
        const ks = keywordScores.get(id) ?? 0;
        const score = 1 / (k + (1 / (vs || 0.001))) + 1 / (k + (1 / (ks || 0.001)));
        const sources: string[] = [];
        if (vs > 0) sources.push('vector');
        if (ks > 0) sources.push('keyword');
        results.push({ id, score, sources });
    }
    return results.sort((a, b) => b.score - a.score);
}
