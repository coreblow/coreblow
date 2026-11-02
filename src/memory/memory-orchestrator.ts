/**
 * CoreBlow — Memory Orchestrator (Powered by Cory Built-in Memory)
 *
 * Unified memory interface backed by Cory (`src/memory/cory.ts`) by default:
 *  - Cory 4-Layer Canonical Markdown + Disposable SQLite WAL Lexical Index: always active, zero config, offline-first
 *  - JSONL TranscriptStore: always active, stream tail-read
 *  - Optional VectorStore + Embedding: opt-in semantic ranking with automatic lexical fallback
 */

import * as crypto from 'node:crypto';
import * as path from 'node:path';
import { TranscriptStore, type TranscriptEntry, type TranscriptStoreConfig } from './transcript-store.js';
import { VectorStore, type VectorSearchResult } from './vector-store.js';
import { createEmbeddingProvider, type EmbeddingProvider } from './embeddings.js';
import { EmbeddingCircuitBreaker } from './embedding-circuit-breaker.js';
import {
    CoryBootstrapService,
    type CoryMemoryItem,
    type CoryMemoryLayer,
    type CoryScope,
    type CorySessionSummaryRecord,
    type CoryStartupSnapshot,
} from './cory.js';
import { logCaughtError } from '../utils/error-boundary.js';

// ─── Types ──────────────────────────────────────────────────────

export interface MemoryConfig {
    /** Directory for JSONL transcripts and Cory state (required) */
    transcriptDir: string;

    /** Optional dedicated Cory state directory (defaults to transcriptDir/cory) */
    coryStateDir?: string;

    /** JSONL store config overrides */
    transcript?: Partial<Omit<TranscriptStoreConfig, 'storeDir'>>;

    /** RAG settings (optional — default OFF) */
    rag?: {
        enabled: boolean;
        engine: 'local' | 'ollama' | 'openai' | 'gemini' | 'voyage' | 'mistral' | 'auto';
        /** API key (only needed for remote engines) */
        apiKey?: string;
        /** Hard document limit on VectorStore */
        maxDocuments: number;
    };
}

export interface MemoryContext {
    /** Recent messages from JSONL (always available) */
    recentMessages: TranscriptEntry[];
    /** Semantic search results from RAG (only if enabled) */
    semanticMatches?: VectorSearchResult[];
    /** Cory startup snapshot (Identity + Durable Workspace + Active Constraints) */
    coryStartupSnapshot?: CoryStartupSnapshot;
    /** Cory lexical/hybrid recalled items */
    coryMatches?: CoryMemoryItem[];
    /** Combined context string for LLM prompt */
    contextText: string;
    /** Whether RAG was used */
    ragUsed: boolean;
}

interface EmbeddingJob {
    id: string;
    sessionId: string;
    content: string;
    role: string;
    contentHash: string;
}

// ─── Memory Orchestrator ────────────────────────────────────────

export class MemoryOrchestrator {
    private transcript: TranscriptStore;
    private vectorStore: VectorStore | null = null;
    private embedder: EmbeddingProvider | null = null;
    public readonly cory: CoryBootstrapService;

    // Async embedding queue
    private embeddingQueue: EmbeddingJob[] = [];
    private queueTimer: ReturnType<typeof setTimeout> | null = null;
    private drainPromise: Promise<void> | null = null;

    // Content hash dedup
    private contentHashes = new Set<string>();

    // Circuit breaker for embedding API
    private circuitBreaker = new EmbeddingCircuitBreaker();

    constructor(config: MemoryConfig) {
        // 1. JSONL — always initialized
        this.transcript = new TranscriptStore({
            storeDir: config.transcriptDir,
            ...config.transcript,
        });

        // 2. RAG — only if enabled
        if (config.rag?.enabled) {
            try {
                this.embedder = createEmbeddingProvider({
                    embeddingBackend: config.rag.engine,
                    openaiKey: config.rag.apiKey,
                });
                this.vectorStore = new VectorStore({
                    dimensions: this.embedder.dimensions,
                    maxDocuments: config.rag.maxDocuments,
                });
            } catch (err) {
                // RAG init failure → degrade to Cory lexical + JSONL only
                logCaughtError('memory-orchestrator:rag-init', err);
                this.embedder = null;
                this.vectorStore = null;
            }
        }

        // 3. Cory Built-in Memory — always initialized, offline-first, zero config
        const coryDir = config.coryStateDir ?? path.join(config.transcriptDir, 'cory');
        this.cory = new CoryBootstrapService({
            stateDir: coryDir,
            embeddingProvider: null, // Keep Cory baseline strictly local & fast; VectorStore handles optional RAG above
        });
    }

    // ─── Cory First-Class Memory Operations ─────────────────────

    /**
     * Store a preference, workspace decision, episodic note, or active constraint in Cory.
     */
    remember(params: {
        layer: CoryMemoryLayer;
        content: string;
        scope?: CoryScope;
        source?: string;
        artifactRef?: string;
        tags?: readonly string[];
    }): CoryMemoryItem | null {
        return this.cory.memoryStore.remember(params);
    }

    /**
     * Forget a memory item by ID or text substring.
     */
    forget(params: { idOrQuery: string; layer?: CoryMemoryLayer; scope?: CoryScope }): number {
        return this.cory.memoryStore.forget(params);
    }

    /**
     * Summarize a completed session and preserve Decisions & Active Constraints in Cory.
     */
    summarizeSession(params: {
        sessionId: string;
        messages: ReadonlyArray<{ role: string; content: string }>;
        explicitDecisions?: readonly string[];
        explicitConstraints?: readonly string[];
        scope?: CoryScope;
        artifactRef?: string;
    }): CorySessionSummaryRecord {
        return this.cory.summaryService.summarizeAndConsolidateSession(params);
    }

    /**
     * Pause or resume persistent Cory memory writes/reads.
     */
    setPaused(paused: boolean): void {
        this.cory.memoryStore.setPaused(paused);
    }

    // ─── Record ─────────────────────────────────────────────────

    /**
     * Record a message. Always writes to JSONL. Optionally queues for RAG.
     */
    recordMessage(sessionId: string, message: {
        role: 'user' | 'assistant';
        content: string;
    }): void {
        // 1. Always: write to JSONL (sync, instant)
        this.transcript.appendMessage(sessionId, {
            type: 'message',
            timestamp: Date.now(),
            message,
        });

        // 2. Hash-based dedup check
        const contentHash = this.hashContent(message.content);
        if (this.contentHashes.has(contentHash)) {
            return;
        }
        this.contentHashes.add(contentHash);

        // 3. Queue embedding job — FIRE AND FORGET
        if (this.vectorStore && this.embedder) {
            this.queueEmbeddingJob({
                id: `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                sessionId,
                content: message.content,
                role: message.role,
                contentHash,
            });
        }
    }

    // ─── Retrieve ───────────────────────────────────────────────

    /**
     * Build context for LLM prompt combining:
     *  - Cory frozen startup snapshot (Identity + Durable Workspace + Active Constraints)
     *  - Cory lexical FTS/BM25 recall
     *  - JSONL recent messages
     *  - Optional RAG semantic matches
     */
    async buildContext(sessionId: string, query: string, opts?: {
        recentCount?: number;
        ragTopK?: number;
        scope?: CoryScope;
    }): Promise<MemoryContext> {
        // 1. Capture Cory session-stable startup snapshot
        const coryStartupSnapshot = this.cory.contextAssembler.getOrCreateStartupSnapshot(
            sessionId,
            opts?.scope,
        );

        // 2. Always: get recent messages from JSONL (stream tail-read)
        const recent = await this.transcript.getRecentMessages(
            sessionId, opts?.recentCount ?? 20,
        );

        // 3. Build hash set of recent messages for dedup
        const recentHashes = new Set<string>();
        for (const entry of recent) {
            if (entry.message?.content) {
                recentHashes.add(this.hashContent(entry.message.content));
            }
        }

        // 4. Cory lexical recall (best-effort, never throws)
        let coryMatches: CoryMemoryItem[] = [];
        if (query.trim() && !this.cory.memoryStore.isPaused()) {
            const coryRecall = await this.cory.retriever.retrieve({
                query,
                scope: opts?.scope,
                topK: opts?.ragTopK ?? 5,
            });
            const snapshotIds = new Set([
                ...coryStartupSnapshot.identityItems.map((i) => i.id),
                ...coryStartupSnapshot.durableItems.map((d) => d.id),
                ...coryStartupSnapshot.activeConstraints.map((c) => c.id),
            ]);
            coryMatches = coryRecall.hits
                .map((h) => h.item)
                .filter((item) => !snapshotIds.has(item.id));
        }

        // 5. RAG search wrapped in try/catch
        let semantic: VectorSearchResult[] | undefined;
        const ragTopK = opts?.ragTopK ?? 5;

        if (this.vectorStore && this.embedder) {
            try {
                const queryEmbedding = await this.embedder.embed(query);
                const rawResults = this.vectorStore.search(queryEmbedding, {
                    topK: ragTopK + recentHashes.size,
                    minScore: 0.3,
                });

                semantic = rawResults.filter(r => {
                    const hash = this.hashContent(r.document.content);
                    return !recentHashes.has(hash);
                }).slice(0, ragTopK);
            } catch (err) {
                logCaughtError('memory-orchestrator:rag-search', err);
                semantic = undefined;
            }
        }

        // 6. Format context
        const contextText = this.formatContext(
            recent,
            semantic,
            coryStartupSnapshot,
            coryMatches,
        );

        return {
            recentMessages: recent,
            semanticMatches: semantic,
            coryStartupSnapshot,
            coryMatches,
            contextText,
            ragUsed: semantic !== undefined && semantic.length > 0,
        };
    }

    // ─── Queue Management ───────────────────────────────────────

    private queueEmbeddingJob(job: EmbeddingJob): void {
        this.embeddingQueue.push(job);

        if (this.queueTimer) clearTimeout(this.queueTimer);
        this.queueTimer = setTimeout(() => {
            this.drainPromise = this.drainEmbeddingQueue();
        }, 100);
    }

    private async drainEmbeddingQueue(): Promise<void> {
        if (!this.embedder || !this.vectorStore) return;

        if (this.circuitBreaker.isOpen()) {
            this.embeddingQueue.splice(0);
            return;
        }

        const batch = this.embeddingQueue.splice(0);
        if (batch.length === 0) return;

        try {
            const embeddings = await this.embedder.embedBatch(
                batch.map(j => j.content),
            );
            this.circuitBreaker.recordSuccess();
            for (let i = 0; i < batch.length; i++) {
                const job = batch[i]!;
                const embedding = embeddings[i];
                if (embedding) {
                    this.vectorStore.add(
                        job.id, job.content, embedding,
                        { sessionId: job.sessionId, role: job.role },
                    );
                }
            }
        } catch (err) {
            this.circuitBreaker.recordFailure();
            logCaughtError('memory-orchestrator:embed', err);
        }
    }

    async flush(): Promise<void> {
        if (this.queueTimer) {
            clearTimeout(this.queueTimer);
            this.queueTimer = null;
        }
        if (this.embeddingQueue.length > 0) {
            await this.drainEmbeddingQueue();
        }
        if (this.drainPromise) {
            await this.drainPromise;
        }
    }

    // ─── Formatting ─────────────────────────────────────────────

    private formatContext(
        recent: TranscriptEntry[],
        semantic?: VectorSearchResult[],
        corySnapshot?: CoryStartupSnapshot,
        coryMatches?: CoryMemoryItem[],
    ): string {
        const parts: string[] = [];

        if (corySnapshot?.formattedSnapshot) {
            parts.push(corySnapshot.formattedSnapshot);
        }

        if (recent.length > 0) {
            const recentText = recent
                .filter(e => e.message?.content)
                .map(e => `${e.message!.role}: ${e.message!.content}`)
                .join('\n');
            if (recentText) {
                parts.push(`## Recent Conversation\n${recentText}`);
            }
        }

        if (coryMatches && coryMatches.length > 0) {
            const coryText = coryMatches
                .map(m => `- [${m.layer}] ${m.content}`)
                .join('\n');
            parts.push(`## Relevant Cory Memory\n${coryText}`);
        }

        if (semantic && semantic.length > 0) {
            const semanticText = semantic
                .map(r => `- [score: ${r.score.toFixed(3)}] ${r.document.content}`)
                .join('\n');
            parts.push(`## Relevant Context (from memory)\n${semanticText}`);
        }

        return parts.join('\n\n');
    }

    // ─── Utilities ──────────────────────────────────────────────

    private hashContent(content: string): string {
        return crypto.createHash('sha256')
            .update(content)
            .digest('hex')
            .slice(0, 16);
    }

    stats(): {
        jsonl: { sessions: number };
        cory: { documents: number; paused: boolean };
        rag: { enabled: boolean; documents: number; provider: string } | null;
    } {
        const coryStats = this.cory.searchIndex.stats();
        return {
            jsonl: {
                sessions: this.transcript.listSessions().length,
            },
            cory: {
                documents: coryStats.documents,
                paused: this.cory.memoryStore.isPaused(),
            },
            rag: this.vectorStore ? {
                enabled: true,
                documents: this.vectorStore.count(),
                provider: this.embedder?.name ?? 'unknown',
            } : null,
        };
    }

    getTranscriptStore(): TranscriptStore {
        return this.transcript;
    }

    getVectorStore(): VectorStore | null {
        return this.vectorStore;
    }

    getCoryService(): CoryBootstrapService {
        return this.cory;
    }
}
