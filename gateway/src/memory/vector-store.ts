/**
 * CoreBlow — Vector Store
 *
 * In-memory vector similarity search for RAG (Retrieval-Augmented
 * Generation). Supports document indexing, cosine similarity search,
 * metadata filtering, and namespace isolation.
 *
 * OPTIMIZATION: Uses Float32Array for embeddings (4 bytes/element)
 * instead of number[] (8 bytes/element) — 49% RAM reduction.
 */

/** Numeric array type for embeddings — accepts both Float32Array and number[] */
export type EmbeddingVector = Float32Array | number[];

/** Document with embedding */
export interface VectorDocument {
    id: string;
    content: string;
    embedding: Float32Array;
    metadata?: Record<string, unknown>;
    namespace?: string;
    createdAt: number;
}

/** Search result */
export interface VectorSearchResult {
    document: VectorDocument;
    score: number;
}

/** Vector store options */
export interface VectorStoreOptions {
    /** Max documents to store (0 = unlimited) */
    maxDocuments?: number;
    /** Embedding dimension */
    dimensions?: number;
}

/**
 * Normalize any embedding input to Float32Array.
 * Accepts Float32Array passthrough or number[] conversion.
 */
export function toFloat32(input: EmbeddingVector): Float32Array {
    if (input instanceof Float32Array) return input;
    return new Float32Array(input);
}

/**
 * CoreBlow Vector Store
 */
export class VectorStore {
    private documents = new Map<string, VectorDocument>();
    private options: Required<VectorStoreOptions>;

    constructor(opts?: VectorStoreOptions) {
        this.options = {
            maxDocuments: opts?.maxDocuments ?? 10_000,
            dimensions: opts?.dimensions ?? 1536,
        };
    }

    /**
     * Add a document with its embedding.
     * Accepts both Float32Array and number[] (auto-converts to Float32Array).
     */
    add(id: string, content: string, embedding: EmbeddingVector, metadata?: Record<string, unknown>, namespace?: string): VectorDocument {
        const doc: VectorDocument = {
            id,
            content,
            embedding: toFloat32(embedding),
            metadata,
            namespace,
            createdAt: Date.now(),
        };
        this.documents.set(id, doc);

        // Enforce limit — find oldest via iteration (no Array.from copy)
        if (this.options.maxDocuments > 0 && this.documents.size > this.options.maxDocuments) {
            let oldestId: string | null = null;
            let oldestTime = Infinity;
            for (const [docId, d] of this.documents) {
                if (d.createdAt < oldestTime) {
                    oldestTime = d.createdAt;
                    oldestId = docId;
                }
            }
            if (oldestId) this.documents.delete(oldestId);
        }

        return doc;
    }

    /**
     * Search for similar documents using cosine similarity.
     * Accepts both Float32Array and number[] query vectors.
     */
    search(queryEmbedding: EmbeddingVector, options?: {
        topK?: number;
        namespace?: string;
        minScore?: number;
        filter?: (doc: VectorDocument) => boolean;
    }): VectorSearchResult[] {
        const topK = options?.topK ?? 10;
        const minScore = options?.minScore ?? 0.0;
        const query = toFloat32(queryEmbedding);
        const results: VectorSearchResult[] = [];

        // Direct iteration — no Array.from() copy
        for (const doc of this.documents.values()) {
            // Namespace filter
            if (options?.namespace && doc.namespace !== options.namespace) continue;

            // Custom filter
            if (options?.filter && !options.filter(doc)) continue;

            const score = cosineSimilarityF32(query, doc.embedding);
            if (score >= minScore) {
                results.push({ document: doc, score });
            }
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    /**
     * Get a document by ID.
     */
    get(id: string): VectorDocument | null {
        return this.documents.get(id) ?? null;
    }

    /**
     * Delete a document.
     */
    delete(id: string): boolean {
        return this.documents.delete(id);
    }

    /**
     * Delete all documents in a namespace.
     */
    deleteNamespace(namespace: string): number {
        let count = 0;
        // Direct iteration — no Array.from() copy
        for (const [id, doc] of this.documents) {
            if (doc.namespace === namespace) {
                this.documents.delete(id);
                count++;
            }
        }
        return count;
    }

    /**
     * Get document count.
     */
    count(namespace?: string): number {
        if (!namespace) return this.documents.size;
        let count = 0;
        for (const doc of this.documents.values()) {
            if (doc.namespace === namespace) count++;
        }
        return count;
    }

    /**
     * List all namespaces.
     */
    listNamespaces(): string[] {
        const namespaces = new Set<string>();
        for (const doc of this.documents.values()) {
            if (doc.namespace) namespaces.add(doc.namespace);
        }
        return Array.from(namespaces);
    }

    /**
     * Clear all documents.
     */
    clear(): void {
        this.documents.clear();
    }
}

// ─── Optimized Cosine Similarity for Float32Array ─────────────────

/**
 * Cosine similarity optimized for Float32Array.
 * Works with both Float32Array and number[] (via duck typing).
 */
export function cosineSimilarityF32(a: Float32Array | number[], b: Float32Array | number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        const ai = a[i]!;
        const bi = b[i]!;
        dotProduct += ai * bi;
        normA += ai * ai;
        normB += bi * bi;
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}
