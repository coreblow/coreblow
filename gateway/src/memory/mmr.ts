/**
 * src/memory/mmr.ts
 * Maximum Marginal Relevance + Cluster Diversity
 * Superior to OpenClaw: adds lightweight k-means clustering for true topic diversity
 */

import { cosineSimilarity } from './embeddings.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('memory:mmr');

export interface ScoredResult<T> {
    entry: T;
    score: number;
    embedding: number[];
}

/**
 * MMR Reranking — balances relevance vs diversity
 * 
 * @param results - scored search results with embeddings
 * @param lambda - balance factor: 1.0 = pure relevance, 0.0 = pure diversity (default: 0.7)
 * @param topK - number of results to return (default: 5)
 */
export function mmrRerank<T>(
    results: ScoredResult<T>[],
    lambda: number = 0.7,
    topK: number = 5,
): ScoredResult<T>[] {
    if (results.length <= topK) return results;

    const selected: ScoredResult<T>[] = [];
    const candidates = [...results];

    // First pick: highest scoring
    const best = candidates.reduce((a, b) => a.score > b.score ? a : b);
    selected.push(best);
    candidates.splice(candidates.indexOf(best), 1);

    // Iteratively select remaining
    while (selected.length < topK && candidates.length > 0) {
        let bestCandidate: ScoredResult<T> | null = null;
        let bestMmrScore = -Infinity;

        for (const candidate of candidates) {
            // Relevance: original similarity score
            const relevance = candidate.score;

            // Diversity: max similarity to any already-selected result
            const maxSimilarity = selected.reduce((max, sel) => {
                const sim = cosineSimilarity(candidate.embedding, sel.embedding);
                return Math.max(max, sim);
            }, -Infinity);

            // MMR score
            const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

            if (mmrScore > bestMmrScore) {
                bestMmrScore = mmrScore;
                bestCandidate = candidate;
            }
        }

        if (bestCandidate) {
            selected.push(bestCandidate);
            candidates.splice(candidates.indexOf(bestCandidate), 1);
        } else {
            break;
        }
    }

    log.debug({ input: results.length, output: selected.length, lambda }, 'MMR reranking complete');
    return selected;
}

/**
 * Cluster-Aware Diversity — lightweight k-means clustering
 * Ensures results come from different topic clusters
 * 
 * SUPERIOR TO OpenClaw: OpenClaw only uses standard MMR
 * CoreBlow adds clustering to guarantee topic diversity
 */
export function clusterDiverseRerank<T>(
    results: ScoredResult<T>[],
    numClusters: number = 3,
    topK: number = 5,
): ScoredResult<T>[] {
    if (results.length <= topK) return results;
    if (results.length < numClusters) numClusters = results.length;

    // Step 1: K-means clustering (simplified, 5 iterations)
    const clusters = kMeansClustering(
        results.map(r => r.embedding),
        numClusters,
        5
    );

    // Step 2: Assign cluster labels
    const clustered: Map<number, ScoredResult<T>[]> = new Map();
    for (let i = 0; i < results.length; i++) {
        const cluster = clusters.assignments[i];
        if (!clustered.has(cluster)) clustered.set(cluster, []);
        clustered.get(cluster)!.push(results[i]);
    }

    // Step 3: Sort within each cluster by score
    for (const items of clustered.values()) {
        items.sort((a, b) => b.score - a.score);
    }

    // Step 4: Round-robin pick from clusters (best from each cluster first)
    const selected: ScoredResult<T>[] = [];
    const clusterKeys = Array.from(clustered.keys());
    let round = 0;

    while (selected.length < topK) {
        let added = false;
        for (const key of clusterKeys) {
            const items = clustered.get(key)!;
            if (round < items.length) {
                selected.push(items[round]);
                added = true;
                if (selected.length >= topK) break;
            }
        }
        if (!added) break;
        round++;
    }

    log.debug({
        input: results.length,
        output: selected.length,
        clusters: numClusters,
    }, 'Cluster-diverse reranking complete');

    return selected;
}

/**
 * Simplified k-means clustering
 */
function kMeansClustering(
    vectors: number[][],
    k: number,
    iterations: number = 5,
): { centroids: number[][]; assignments: number[] } {
    const dim = vectors[0]?.length || 0;
    if (dim === 0 || vectors.length === 0) {
        return { centroids: [], assignments: [] };
    }

    // Initialize centroids: pick k random vectors
    const indices = new Set<number>();
    while (indices.size < k && indices.size < vectors.length) {
        indices.add(Math.floor(Math.random() * vectors.length));
    }
    let centroids = Array.from(indices).map(i => [...vectors[i]]);
    let assignments = new Array(vectors.length).fill(0);

    for (let iter = 0; iter < iterations; iter++) {
        // Assign each vector to nearest centroid
        for (let i = 0; i < vectors.length; i++) {
            let bestDist = Infinity;
            let bestCluster = 0;
            for (let c = 0; c < centroids.length; c++) {
                const dist = euclideanDistance(vectors[i], centroids[c]);
                if (dist < bestDist) {
                    bestDist = dist;
                    bestCluster = c;
                }
            }
            assignments[i] = bestCluster;
        }

        // Update centroids
        const newCentroids: number[][] = Array.from({ length: k }, () => new Array(dim).fill(0));
        const counts = new Array(k).fill(0);

        for (let i = 0; i < vectors.length; i++) {
            const c = assignments[i];
            counts[c]++;
            for (let d = 0; d < dim; d++) {
                newCentroids[c][d] += vectors[i][d];
            }
        }

        for (let c = 0; c < k; c++) {
            if (counts[c] > 0) {
                for (let d = 0; d < dim; d++) {
                    newCentroids[c][d] /= counts[c];
                }
            }
        }

        centroids = newCentroids;
    }

    return { centroids, assignments };
}

function euclideanDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
        const diff = a[i] - b[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

export { kMeansClustering, euclideanDistance };
