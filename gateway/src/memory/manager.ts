/**
 * src/memory/manager.ts
 * Memory Manager — high-level API for the memory system
 * Orchestrates embeddings, vector store, and auto-memorization
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { createEmbeddingProvider, type EmbeddingProvider } from './embeddings.js';
import { VectorStore, type MemoryEntry, type SearchResult } from './vector-store.js';
import { getHomeDir } from '../gateway/config.js';

const log = createChildLogger('memory:manager');

export interface MemoryConfig {
    enabled: boolean;
    embeddingBackend: 'local' | 'ollama' | 'openai';
    embeddingModel?: string;
    ollamaUrl?: string;
    openaiKey?: string;
    maxMemories: number;
    autoMemorize: boolean;       // auto-extract important facts
    autoSummarize: boolean;      // summarize sessions on end
    importanceThreshold: number; // 0-1, minimum importance to auto-store
}

const DEFAULT_CONFIG: MemoryConfig = {
    enabled: true,
    embeddingBackend: 'local',
    maxMemories: 10000,
    autoMemorize: true,
    autoSummarize: true,
    importanceThreshold: 0.5,
};

export class MemoryManager {
    private embedder!: EmbeddingProvider;
    private store!: VectorStore;
    private config: MemoryConfig;

    constructor(config: Partial<MemoryConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Initialize the memory system
     */
    async init(): Promise<void> {
        const homeDir = getHomeDir();
        const memoryDir = path.join(homeDir, 'memory');
        const storePath = path.join(memoryDir, 'vectors.jsonl');

        this.embedder = createEmbeddingProvider({
            embeddingBackend: this.config.embeddingBackend,
            ollamaUrl: this.config.ollamaUrl,
            openaiKey: this.config.openaiKey,
            embeddingModel: this.config.embeddingModel,
        });

        this.store = new VectorStore(storePath);

        log.info({
            backend: this.config.embeddingBackend,
            memories: this.store.size,
            autoMemorize: this.config.autoMemorize,
        }, 'Memory system initialized');
    }

    // ========== Core Operations ==========

    /**
     * Store a new memory
     */
    async store_memory(text: string, opts: {
        type?: MemoryEntry['metadata']['type'];
        tags?: string[];
        source?: string;
        userId?: string;
        sessionId?: string;
        importance?: number;
    } = {}): Promise<string> {
        const id = randomUUID().substring(0, 8);
        const embedding = await this.embedder.embed(text);

        const entry: MemoryEntry = {
            id,
            text,
            embedding,
            metadata: {
                source: opts.source || 'manual',
                timestamp: Date.now(),
                tags: opts.tags || [],
                type: opts.type || 'note',
                userId: opts.userId,
                sessionId: opts.sessionId,
                importance: opts.importance ?? 0.5,
            },
        };

        await this.store.add(entry);

        // Enforce max memories limit
        if (this.store.size > this.config.maxMemories) {
            this.store.pruneOld(30 * 24 * 60 * 60 * 1000); // Prune > 30 days
        }

        return id;
    }

    /**
     * Recall memories by semantic similarity
     */
    async recall(query: string, opts: {
        topK?: number;
        minScore?: number;
        type?: MemoryEntry['metadata']['type'];
        userId?: string;
        tags?: string[];
    } = {}): Promise<SearchResult[]> {
        const queryEmbedding = await this.embedder.embed(query);

        return this.store.search(queryEmbedding, {
            topK: opts.topK || 10,
            minScore: opts.minScore || 0.3,
            filter: {
                type: opts.type,
                userId: opts.userId,
                tags: opts.tags,
            },
        });
    }

    /**
     * Keyword search fallback
     */
    searchKeyword(query: string, topK = 10): SearchResult[] {
        return this.store.searchByKeyword(query, topK);
    }

    /**
     * Forget a specific memory
     */
    forget(memoryId: string): boolean {
        return this.store.delete(memoryId);
    }

    /**
     * List recent memories
     */
    recent(count = 20): MemoryEntry[] {
        return this.store.getRecent(count);
    }

    /**
     * Get memories by tag
     */
    byTag(tag: string): MemoryEntry[] {
        return this.store.getByTag(tag);
    }

    /**
     * Get all stats
     */
    stats() {
        return {
            ...this.store.stats(),
            embeddingBackend: this.config.embeddingBackend,
            embeddingDimensions: this.embedder.dimensions,
            autoMemorize: this.config.autoMemorize,
        };
    }

    // ========== Auto-Memorization ==========

    /**
     * Process a message for auto-memorization
     * Extracts facts, preferences, and important information
     */
    async processMessage(message: string, meta: {
        source: string;
        userId?: string;
        sessionId?: string;
    }): Promise<string[]> {
        if (!this.config.autoMemorize) return [];

        const storedIds: string[] = [];

        // Extract facts (statements with "is", "are", personal info, etc.)
        const facts = this.extractFacts(message);
        for (const fact of facts) {
            // Check if we already know this
            const existing = await this.recall(fact, { topK: 1, minScore: 0.85 });
            if (existing.length > 0) continue; // Already stored

            const id = await this.store_memory(fact, {
                type: 'fact',
                source: meta.source,
                userId: meta.userId,
                sessionId: meta.sessionId,
                importance: 0.7,
                tags: ['auto-extracted'],
            });
            storedIds.push(id);
        }

        // Extract preferences ("I like", "I prefer", "my favorite")
        const prefs = this.extractPreferences(message);
        for (const pref of prefs) {
            const existing = await this.recall(pref, { topK: 1, minScore: 0.8 });
            if (existing.length > 0) continue;

            const id = await this.store_memory(pref, {
                type: 'preference',
                source: meta.source,
                userId: meta.userId,
                sessionId: meta.sessionId,
                importance: 0.8,
                tags: ['auto-extracted', 'preference'],
            });
            storedIds.push(id);
        }

        if (storedIds.length > 0) {
            log.debug({ count: storedIds.length, source: meta.source }, 'Auto-memorized facts');
        }

        return storedIds;
    }

    /**
     * Summarize and store a session when it ends
     */
    async summarizeSession(sessionId: string, messages: Array<{ role: string; content: string }>): Promise<string | null> {
        if (!this.config.autoSummarize || messages.length < 3) return null;

        // Build a simple summary from the conversation
        const userMessages = messages.filter(m => m.role === 'user').map(m => m.content);
        const topics = userMessages.slice(0, 5).map(m => m.substring(0, 100));
        const summary = `Session topic${topics.length > 1 ? 's' : ''}: ${topics.join('; ')}. Total messages: ${messages.length}.`;

        const id = await this.store_memory(summary, {
            type: 'summary',
            sessionId,
            importance: 0.6,
            tags: ['session-summary'],
        });

        log.info({ sessionId, summary: summary.substring(0, 100) }, 'Session summarized');
        return id;
    }

    /**
     * Build context injection for system prompt
     * Retrieves relevant memories for the current conversation
     */
    async buildContext(currentMessage: string, userId?: string): Promise<string> {
        const results = await this.recall(currentMessage, {
            topK: 5,
            minScore: 0.4,
            userId,
        });

        if (results.length === 0) return '';

        const memoryLines = results.map(r => {
            const age = this.formatAge(r.entry.metadata.timestamp);
            return `- [${r.entry.metadata.type}] ${r.entry.text} (${age}, relevance: ${(r.score * 100).toFixed(0)}%)`;
        });

        return `\n\n## Relevant Memories\n${memoryLines.join('\n')}`;
    }

    // ========== Private Helpers ==========

    private extractFacts(text: string): string[] {
        const facts: string[] = [];
        const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 10);

        for (const sentence of sentences) {
            const lower = sentence.toLowerCase();

            // Personal facts
            if (/\b(my name is|i am|i'm|i live|i work|i study|my job|my age|i was born)\b/i.test(lower)) {
                facts.push(sentence);
            }
            // Definitions/facts
            if (/\b(is a|is the|are the|was founded|was created|means that)\b/i.test(lower) && sentence.length < 200) {
                facts.push(sentence);
            }
            // Important info with numbers
            if (/\b(password|api key|token|port|address|version|budget|deadline|phone|email)\b/i.test(lower)) {
                facts.push(sentence);
            }
        }

        return facts.slice(0, 5); // Max 5 facts per message
    }

    private extractPreferences(text: string): string[] {
        const prefs: string[] = [];
        const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(s => s.length > 8);

        for (const sentence of sentences) {
            if (/\b(i like|i love|i prefer|i enjoy|i hate|i dislike|my favorite|i always|i never|i want)\b/i.test(sentence)) {
                prefs.push(sentence);
            }
        }

        return prefs.slice(0, 3);
    }

    private formatAge(timestamp: number): string {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    /**
     * Shutdown — save everything
     */
    close(): void {
        this.store.close();
        log.info('Memory system closed');
    }
}
