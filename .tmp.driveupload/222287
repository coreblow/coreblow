/**
 * CoreBlow — RAG Pipeline Orchestrator
 *
 * Full pipeline: Load → Chunk → Embed → Store → Query → Fuse → Rerank → Context
 *
 * Combines all RAG foundation components:
 *  - DocumentLoader (multi-format)
 *  - RecursiveChunker (contextual prepending)
 *  - EmbeddingProvider (auto-select + fallback)
 *  - HybridSearch v2 (BM25 + RRF)
 *  - MMR reranking (diversity)
 */

import { DocumentLoader, type RawDocument, type LoaderConfig } from './document-loader.js';
import { recursiveChunk, type ChunkConfig, type Chunk } from './recursive-chunker.js';
import { cosineSimilarity, createEmbeddingProvider, type EmbeddingProvider } from '../memory/embeddings.js';
import { HybridSearch, type HybridSearchConfig, type HybridResult, type MemEntry } from '../memory/hybrid-search.js';
import { mmrRerank } from '../memory/mmr.js';

// ─── Types ──────────────────────────────────────────────────────

export interface RAGPipelineConfig {
    /** Document loader options */
    loader?: LoaderConfig;
    /** Chunker options */
    chunker?: Partial<ChunkConfig>;
    /** Search options */
    search?: Partial<HybridSearchConfig>;
    /** Embedding backend */
    embeddingBackend?: 'local' | 'ollama' | 'openai';
    /** OpenAI key for embeddings */
    openaiKey?: string;
    /** Embedding dimensions */
    embeddingDims?: number;
    /** MMR lambda for reranking (0 = max diversity, 1 = max relevance) */
    mmrLambda?: number;
    /** Maximum context tokens to return */
    maxContextTokens?: number;
}

export interface RAGDocument {
    /** Unique chunk ID */
    id: string;
    /** Chunk text (with context prefix) */
    text: string;
    /** Raw text (without prefix) */
    rawText: string;
    /** Source file path */
    sourcePath: string;
    /** Context heading hierarchy */
    context: string[];
    /** Embedding vector */
    embedding: Float32Array;
    /** Ingestion timestamp */
    ingestedAt: number;
}

export interface RAGQueryResult {
    /** Relevant document chunks */
    documents: RAGDocument[];
    /** Combined context string for LLM */
    contextText: string;
    /** Query expansion info */
    queryInfo: {
        original: string;
        fusionMode: string;
        totalCandidates: number;
        returnedResults: number;
    };
}

export interface RAGStats {
    totalDocuments: number;
    totalChunks: number;
    embeddingProvider: string;
    fusionMode: string;
}

// ─── Pipeline ───────────────────────────────────────────────────

export class RAGPipeline {
    private config: RAGPipelineConfig;
    private loader: DocumentLoader;
    private embeddingProvider: EmbeddingProvider;
    private searchEngine: HybridSearch;
    private store: RAGDocument[] = [];

    /** Callbacks for pipeline stages */
    public onChunk?: (chunk: Chunk, sourcePath: string) => void;
    public onEmbed?: (docId: string) => void;
    public onStore?: (doc: RAGDocument) => void;
    public onQuery?: (query: string, resultCount: number) => void;

    constructor(config?: RAGPipelineConfig) {
        this.config = config ?? {};
        this.loader = new DocumentLoader(config?.loader);
        this.embeddingProvider = createEmbeddingProvider({
            embeddingBackend: config?.embeddingBackend,
            openaiKey: config?.openaiKey,
            dims: config?.embeddingDims,
        });
        this.searchEngine = new HybridSearch(config?.search);
    }

    // ── Ingest ──

    /**
     * Ingest documents from file paths or directories.
     * Load → Chunk → Embed → Store
     */
    async ingest(sources: string[]): Promise<{ ingested: number; chunks: number }> {
        const rawDocs = await this.loader.loadSources(sources);
        return this.ingestRawDocuments(rawDocs);
    }

    /**
     * Ingest a single directory recursively.
     */
    async ingestDirectory(dirPath: string): Promise<{ ingested: number; chunks: number }> {
        const rawDocs = await this.loader.loadDirectory(dirPath);
        return this.ingestRawDocuments(rawDocs);
    }

    /**
     * Ingest raw text directly (no file loading needed).
     */
    async ingestText(text: string, sourcePath = 'inline'): Promise<{ chunks: number }> {
        const chunks = recursiveChunk(text, this.config.chunker);
        let count = 0;

        for (const chunk of chunks) {
            this.onChunk?.(chunk, sourcePath);
            const embedding = await this.embeddingProvider.embed(chunk.content);
            const doc = this.createRAGDocument(chunk, sourcePath, embedding);
            this.store.push(doc);
            this.onStore?.(doc);
            count++;
        }

        return { chunks: count };
    }

    /**
     * Process raw documents through the pipeline.
     */
    private async ingestRawDocuments(rawDocs: RawDocument[]): Promise<{ ingested: number; chunks: number }> {
        let totalChunks = 0;

        for (const rawDoc of rawDocs) {
            const chunks = recursiveChunk(rawDoc.content, this.config.chunker);

            for (const chunk of chunks) {
                this.onChunk?.(chunk, rawDoc.path);
                const embedding = await this.embeddingProvider.embed(chunk.content);
                this.onEmbed?.(chunk.content.slice(0, 50));
                const doc = this.createRAGDocument(chunk, rawDoc.path, embedding);
                this.store.push(doc);
                this.onStore?.(doc);
                totalChunks++;
            }
        }

        // Rebuild BM25 index
        this.rebuildSearchIndex();

        return { ingested: rawDocs.length, chunks: totalChunks };
    }

    // ── Query ──

    /**
     * Query the RAG store.
     * Returns relevant chunks + assembled context string for LLM.
     */
    async query(queryText: string, topK = 5): Promise<RAGQueryResult> {
        if (this.store.length === 0) {
            return {
                documents: [],
                contextText: '',
                queryInfo: {
                    original: queryText,
                    fusionMode: 'none',
                    totalCandidates: 0,
                    returnedResults: 0,
                },
            };
        }

        // Convert store to MemEntry format for search
        const entries: MemEntry[] = this.store.map(doc => ({
            id: doc.id,
            text: doc.text,
            embedding: doc.embedding,
            metadata: {
                timestamp: doc.ingestedAt,
                importance: 0.5,
                sourcePath: doc.sourcePath,
            },
        }));

        // Embed query
        const queryEmbedding = await this.embeddingProvider.embed(queryText);

        // Hybrid search (BM25 + Vector via RRF or linear)
        const searchResults = this.searchEngine.search(entries, queryEmbedding, queryText);

        // MMR reranking for diversity
        const mmrLambda = this.config.mmrLambda ?? 0.7;
        const mmrInput = searchResults.map(r => ({
            entry: r.entry,
            score: r.score,
            embedding: r.entry.embedding,
        }));
        const reranked = mmrRerank(mmrInput, mmrLambda, topK);

        // Map back to RAG documents
        const resultDocs = reranked
            .map(r => this.store.find(d => d.id === r.entry.id))
            .filter((d): d is RAGDocument => d !== undefined);

        // Build context string with token limit
        const maxTokens = this.config.maxContextTokens ?? 2000;
        const contextText = this.assembleContext(resultDocs, maxTokens);

        this.onQuery?.(queryText, resultDocs.length);

        return {
            documents: resultDocs,
            contextText,
            queryInfo: {
                original: queryText,
                fusionMode: this.searchEngine.getStats().fusionMode,
                totalCandidates: entries.length,
                returnedResults: resultDocs.length,
            },
        };
    }

    // ── Store Management ──

    /**
     * Get pipeline statistics.
     */
    stats(): RAGStats {
        const sourcePaths = new Set(this.store.map(d => d.sourcePath));
        return {
            totalDocuments: sourcePaths.size,
            totalChunks: this.store.length,
            embeddingProvider: this.embeddingProvider.name,
            fusionMode: this.searchEngine.getStats().fusionMode,
        };
    }

    /**
     * Clear all stored documents.
     */
    clear(): void {
        this.store = [];
    }

    /**
     * Get all stored documents.
     */
    getDocuments(): RAGDocument[] {
        return [...this.store];
    }

    /**
     * Remove documents from a specific source path.
     */
    removeSource(sourcePath: string): number {
        const before = this.store.length;
        this.store = this.store.filter(d => d.sourcePath !== sourcePath);
        this.rebuildSearchIndex();
        return before - this.store.length;
    }

    // ── Internal ──

    private createRAGDocument(chunk: Chunk, sourcePath: string, embedding: Float32Array): RAGDocument {
        return {
            id: `${sourcePath}:${chunk.index}:${Date.now()}`,
            text: chunk.content,
            rawText: chunk.content,
            sourcePath,
            context: chunk.metadata?.context as string[] ?? [],
            embedding,
            ingestedAt: Date.now(),
        };
    }

    private rebuildSearchIndex(): void {
        const entries: MemEntry[] = this.store.map(doc => ({
            id: doc.id,
            text: doc.rawText,
            embedding: doc.embedding,
            metadata: { timestamp: doc.ingestedAt, importance: 0.5 },
        }));
        this.searchEngine.buildIndex(entries);
    }

    /**
     * Assemble context string from documents, respecting token limit.
     */
    private assembleContext(docs: RAGDocument[], maxTokens: number): string {
        const CHARS_PER_TOKEN = 4;
        const maxChars = maxTokens * CHARS_PER_TOKEN;
        const parts: string[] = [];
        let totalChars = 0;

        for (const doc of docs) {
            const contextHeader = doc.context.length > 0
                ? `[Source: ${doc.sourcePath} | ${doc.context.join(' > ')}]`
                : `[Source: ${doc.sourcePath}]`;
            const block = `${contextHeader}\n${doc.rawText}`;

            if (totalChars + block.length > maxChars) {
                // Add truncated version
                const remaining = maxChars - totalChars;
                if (remaining > 100) {
                    parts.push(block.slice(0, remaining) + '...');
                }
                break;
            }

            parts.push(block);
            totalChars += block.length;
        }

        return parts.join('\n\n---\n\n');
    }
}
