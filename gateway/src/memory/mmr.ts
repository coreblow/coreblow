/**
 * CoreBlow — MMR (Maximal Marginal Relevance) + Clustering
 */
import { cosineSimilarity } from './embeddings.js';

interface ScoredResult { entry: { id?: string; text?: string }; score: number; embedding: Float32Array | number[]; }

export function euclideanDistance(a: Float32Array | number[], b: Float32Array | number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) sum += ((a[i] ?? 0) - (b[i] ?? 0)) ** 2;
    return Math.sqrt(sum);
}

export function kMeansClustering(vectors: (Float32Array | number[])[], k: number, maxIter = 10): { assignments: number[]; centroids: (Float32Array | number[])[] } {
    if (vectors.length === 0) return { assignments: [], centroids: [] };
    if (vectors.length <= k) {
        return { assignments: vectors.map((_, i) => i % k), centroids: vectors.slice(0, k) };
    }

    // Initialize centroids (pick spread apart)
    let centroids = vectors.slice(0, k).map(v => [...v]);
    let assignments = new Array(vectors.length).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
        // Assign
        let changed = false;
        for (let i = 0; i < vectors.length; i++) {
            let best = 0, bestDist = Infinity;
            for (let c = 0; c < k; c++) {
                const d = euclideanDistance(vectors[i]!, centroids[c]!);
                if (d < bestDist) { bestDist = d; best = c; }
            }
            if (assignments[i] !== best) { assignments[i] = best; changed = true; }
        }
        if (!changed) break;

        // Update centroids
        centroids = Array.from({ length: k }, () => new Array(vectors[0]!.length).fill(0));
        const counts = new Array(k).fill(0);
        for (let i = 0; i < vectors.length; i++) {
            const c = assignments[i]!;
            counts[c]++;
            for (let d = 0; d < vectors[i]!.length; d++) {
                centroids[c]![d] += vectors[i]![d] ?? 0;
            }
        }
        for (let c = 0; c < k; c++) {
            if (counts[c]! > 0) centroids[c] = centroids[c]!.map(v => v / counts[c]!);
        }
    }

    return { assignments, centroids };
}

export function mmrRerank(results: ScoredResult[], lambda: number, topK: number): ScoredResult[] {
    if (results.length === 0) return [];
    const selected: ScoredResult[] = [];
    const remaining = [...results].sort((a, b) => b.score - a.score);

    selected.push(remaining.shift()!);

    while (selected.length < topK && remaining.length > 0) {
        let bestIdx = 0, bestMmr = -Infinity;
        for (let i = 0; i < remaining.length; i++) {
            const r = remaining[i]!;
            const maxSim = Math.max(...selected.map(s => cosineSimilarity(r.embedding, s.embedding)));
            const mmr = lambda * r.score - (1 - lambda) * maxSim;
            if (mmr > bestMmr) { bestMmr = mmr; bestIdx = i; }
        }
        selected.push(remaining.splice(bestIdx, 1)[0]!);
    }
    return selected;
}

export function clusterDiverseRerank(results: ScoredResult[], numClusters: number, topK: number): ScoredResult[] {
    if (results.length === 0) return [];
    if (results.length <= topK) return results;

    const vectors = results.map(r => r.embedding);
    const { assignments } = kMeansClustering(vectors, Math.min(numClusters, results.length), 10);

    // Group by cluster
    const clusters = new Map<number, ScoredResult[]>();
    for (let i = 0; i < results.length; i++) {
        const c = assignments[i]!;
        if (!clusters.has(c)) clusters.set(c, []);
        clusters.get(c)!.push(results[i]!);
    }
    for (const c of clusters.values()) c.sort((a, b) => b.score - a.score);

    // Round-robin pick from clusters
    const output: ScoredResult[] = [];
    const arrays = Array.from(clusters.values());
    let idx = 0;
    while (output.length < topK && arrays.some(a => a.length > 0)) {
        const arr = arrays[idx % arrays.length]!;
        if (arr.length > 0) output.push(arr.shift()!);
        idx++;
    }
    return output;
}
