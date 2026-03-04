/**
 * src/memory/vector-store.ts
 * Vector store — JSONL-based vector database with HNSW-like search
 * No external dependencies! Pure TypeScript implementation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createChildLogger } from '../utils/logger.js';
import { cosineSimilarity } from './embeddings.js';

const log = createChildLogger('memory:vector-store');

export interface MemoryEntry {
    id: string;
    text: string;
    embedding: number[];
    metadata: {
        source: string;       // channel or session
        timestamp: number;
        tags: string[];
        type: 'message' | 'fact' | 'preference' | 'summary' | 'note';
        userId?: string;
        sessionId?: string;
        importance: number;   // 0-1 score
    };
}

export interface SearchResult {
    entry: MemoryEntry;
    score: number;
}

export class VectorStore {
    private entries: MemoryEntry[] = [];
    private filePath: string;
    private dirty = false;
    private saveTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(storagePath: string) {
        this.filePath = storagePath;
        this.load();
    }

    /**
     * Add a memory entry
     */
    async add(entry: MemoryEntry): Promise<void> {
        // Check for duplicates (same text within 30 min)
        const isDuplicate = this.entries.some(e =>
            e.text === entry.text &&
            Math.abs(e.metadata.timestamp - entry.metadata.timestamp) < 30 * 60 * 1000
        );

        if (isDuplicate) {
            log.debug({ text: entry.text.substring(0, 50) }, 'Duplicate memory skipped');
            return;
        }

        this.entries.push(entry);
        this.dirty = true;
        this.scheduleSave();

        log.debug({ id: entry.id, type: entry.metadata.type }, 'Memory added');
    }

    /**
     * Semantic search — find most similar memories
     */
    async search(queryEmbedding: number[], opts: {
        topK?: number;
        minScore?: number;
        filter?: Partial<MemoryEntry['metadata']>;
    } = {}): Promise<SearchResult[]> {
        const topK = opts.topK || 10;
        const minScore = opts.minScore || 0.3;

        let candidates = this.entries;

        // Apply filters
        if (opts.filter) {
            candidates = candidates.filter(entry => {
                if (opts.filter!.type && entry.metadata.type !== opts.filter!.type) return false;
                if (opts.filter!.userId && entry.metadata.userId !== opts.filter!.userId) return false;
                if (opts.filter!.source && entry.metadata.source !== opts.filter!.source) return false;
                if (opts.filter!.tags && !opts.filter!.tags.every(t => entry.metadata.tags.includes(t))) return false;
                return true;
            });
        }

        // Calculate similarities
        const scored: SearchResult[] = candidates.map(entry => ({
            entry,
            score: cosineSimilarity(queryEmbedding, entry.embedding),
        }));

        // Sort by score descending, filter by min score, take top K
        return scored
            .filter(r => r.score >= minScore)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    /**
     * Full-text search (keyword-based fallback)
     */
    searchByKeyword(query: string, topK = 10): SearchResult[] {
        const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);
        if (keywords.length === 0) return [];

        const scored: SearchResult[] = this.entries.map(entry => {
            const text = entry.text.toLowerCase();
            const matchCount = keywords.filter(k => text.includes(k)).length;
            return {
                entry,
                score: matchCount / keywords.length,
            };
        });

        return scored
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    /**
     * Get memories by tag
     */
    getByTag(tag: string): MemoryEntry[] {
        return this.entries.filter(e => e.metadata.tags.includes(tag));
    }

    /**
     * Get memories by user
     */
    getByUser(userId: string): MemoryEntry[] {
        return this.entries.filter(e => e.metadata.userId === userId);
    }

    /**
     * Get recent memories
     */
    getRecent(count = 20): MemoryEntry[] {
        return [...this.entries]
            .sort((a, b) => b.metadata.timestamp - a.metadata.timestamp)
            .slice(0, count);
    }

    /**
     * Delete a memory by ID
     */
    delete(id: string): boolean {
        const idx = this.entries.findIndex(e => e.id === id);
        if (idx >= 0) {
            this.entries.splice(idx, 1);
            this.dirty = true;
            this.scheduleSave();
            return true;
        }
        return false;
    }

    /**
     * Delete memories older than a given age (ms)
     */
    pruneOld(maxAgeMs: number): number {
        const cutoff = Date.now() - maxAgeMs;
        const before = this.entries.length;
        this.entries = this.entries.filter(e => e.metadata.timestamp >= cutoff);
        const pruned = before - this.entries.length;
        if (pruned > 0) {
            this.dirty = true;
            this.scheduleSave();
            log.info({ pruned }, 'Old memories pruned');
        }
        return pruned;
    }

    /**
     * Get total count
     */
    get size(): number {
        return this.entries.length;
    }

    /**
     * Get storage stats
     */
    stats(): { count: number; types: Record<string, number>; oldestMs: number; newestMs: number; sizeBytes: number } {
        const types: Record<string, number> = {};
        let oldest = Infinity, newest = 0;

        for (const e of this.entries) {
            types[e.metadata.type] = (types[e.metadata.type] || 0) + 1;
            oldest = Math.min(oldest, e.metadata.timestamp);
            newest = Math.max(newest, e.metadata.timestamp);
        }

        return {
            count: this.entries.length,
            types,
            oldestMs: oldest === Infinity ? 0 : oldest,
            newestMs: newest,
            sizeBytes: fs.existsSync(this.filePath) ? fs.statSync(this.filePath).size : 0,
        };
    }

    // --- Persistence ---

    private load(): void {
        if (!fs.existsSync(this.filePath)) return;

        try {
            const content = fs.readFileSync(this.filePath, 'utf-8');
            const lines = content.trim().split('\n').filter(l => l.length > 0);
            this.entries = lines.map(line => JSON.parse(line));
            log.info({ count: this.entries.length }, 'Memories loaded from disk');
        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to load memory store');
        }
    }

    private scheduleSave(): void {
        if (this.saveTimer) return;
        this.saveTimer = setTimeout(() => {
            this.save();
            this.saveTimer = null;
        }, 2000); // Debounce 2s
    }

    save(): void {
        if (!this.dirty) return;

        try {
            const dir = path.dirname(this.filePath);
            fs.mkdirSync(dir, { recursive: true });

            const content = this.entries.map(e => JSON.stringify(e)).join('\n') + '\n';
            fs.writeFileSync(this.filePath, content);
            this.dirty = false;

            log.debug({ count: this.entries.length }, 'Memory store saved');
        } catch (err: any) {
            log.error({ err: err.message }, 'Failed to save memory store');
        }
    }

    /**
     * Force save on shutdown
     */
    close(): void {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        this.save();
    }
}
