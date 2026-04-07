/**
 * CoreBlow — JSONL Transcript Store
 *
 * Always-on session memory layer. Append-only JSONL file per session.
 * Stream-based tail-read for retrieval (never loads full file).
 *
 * Features:
 *  - O(1) append (fs append mode)
 *  - Stream tail-read via fs.open + seek from EOF (64KB chunks)
 *  - Size-based auto-compaction
 *  - Corrupted line handling (graceful skip)
 *  - Zero RAM overhead (disk-based)
 *  - Zero external dependency (no API needed)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logCaughtError } from '../utils/error-boundary.js';

// ─── Types ──────────────────────────────────────────────────────

export interface TranscriptMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokens?: number;
}

export interface TranscriptEntry {
    type: 'message' | 'system' | 'compaction';
    timestamp: number;
    message?: TranscriptMessage;
    summary?: string;
}

export interface TranscriptStoreConfig {
    /** Directory to store .jsonl files */
    storeDir: string;
    /** Max messages to retrieve for context (default: 20) */
    defaultRetrievalCount: number;
    /** Max file size in bytes before auto-compaction (default: 512KB) */
    maxFileSizeBytes: number;
    /** Compaction strategy */
    compactionStrategy: 'truncate' | 'summarize';
    /** Tail-read chunk size in bytes (default: 64KB) */
    tailChunkBytes: number;
}

const DEFAULT_CONFIG: TranscriptStoreConfig = {
    storeDir: '',
    defaultRetrievalCount: 20,
    maxFileSizeBytes: 512 * 1024,
    compactionStrategy: 'truncate',
    tailChunkBytes: 64 * 1024,
};

// ─── TranscriptStore ────────────────────────────────────────────

export class TranscriptStore {
    private config: TranscriptStoreConfig;

    constructor(config: Partial<TranscriptStoreConfig> & { storeDir: string }) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        // Ensure directory exists
        if (this.config.storeDir && !fs.existsSync(this.config.storeDir)) {
            fs.mkdirSync(this.config.storeDir, { recursive: true });
        }
    }

    /**
     * Get the file path for a session.
     */
    getSessionFilePath(sessionId: string): string {
        const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
        return path.join(this.config.storeDir, `${safe}.jsonl`);
    }

    /**
     * Append a message to a session transcript.
     * O(1) — uses fs append mode, atomic at OS level.
     */
    appendMessage(sessionId: string, entry: TranscriptEntry): void {
        const filePath = this.getSessionFilePath(sessionId);
        const line = JSON.stringify(entry) + '\n';
        try {
            fs.appendFileSync(filePath, line, { encoding: 'utf-8' });
        } catch (e) {
            logCaughtError('transcript-store:append', e);
        }
    }

    /**
     * Stream-based tail read — reads last N messages from EOF.
     *
     * Algorithm (inspired by OpenClaw's readLastNonzeroUsageFromSessionLog):
     * 1. fs.open(path, 'r')
     * 2. stat → get file size
     * 3. seek to (fileSize - chunkSize)
     * 4. read chunk, split by \n
     * 5. parse last N valid JSON lines
     * 6. if not enough, seek backwards again
     */
    async getRecentMessages(sessionId: string, count?: number): Promise<TranscriptEntry[]> {
        const targetCount = count ?? this.config.defaultRetrievalCount;
        const filePath = this.getSessionFilePath(sessionId);

        if (!fs.existsSync(filePath)) {
            return [];
        }

        let handle: fs.promises.FileHandle | null = null;
        try {
            handle = await fs.promises.open(filePath, 'r');
            const stat = await handle.stat();
            let position = stat.size;
            const results: TranscriptEntry[] = [];
            let leadingPartial = '';

            while (position > 0 && results.length < targetCount) {
                const chunkSize = Math.min(this.config.tailChunkBytes, position);
                const start = position - chunkSize;
                const buffer = Buffer.allocUnsafe(chunkSize);
                const { bytesRead } = await handle.read(buffer, 0, chunkSize, start);

                if (bytesRead <= 0) break;

                const chunk = buffer.toString('utf-8', 0, bytesRead);
                const combined = chunk + leadingPartial;
                const lines = combined.split('\n');
                leadingPartial = lines.shift() ?? '';

                // Parse from end (most recent first)
                for (let i = lines.length - 1; i >= 0 && results.length < targetCount; i--) {
                    const trimmed = lines[i]?.trim();
                    if (!trimmed) continue;
                    try {
                        const entry = JSON.parse(trimmed) as TranscriptEntry;
                        if (entry.type === 'message' && entry.message) {
                            results.push(entry);
                        }
                    } catch {
                        // Skip corrupted lines — graceful degradation
                    }
                }
                position = start;
            }

            // Handle the leading partial line from the first chunk
            if (results.length < targetCount && leadingPartial.trim()) {
                try {
                    const entry = JSON.parse(leadingPartial.trim()) as TranscriptEntry;
                    if (entry.type === 'message' && entry.message) {
                        results.push(entry);
                    }
                } catch {
                    // skip
                }
            }

            return results.reverse(); // chronological order
        } catch {
            return [];
        } finally {
            await handle?.close();
        }
    }

    /**
     * Check if a session transcript should be compacted.
     */
    shouldCompact(sessionId: string): boolean {
        const filePath = this.getSessionFilePath(sessionId);
        try {
            const stat = fs.statSync(filePath);
            return stat.size >= this.config.maxFileSizeBytes;
        } catch {
            return false;
        }
    }

    /**
     * Compact a session transcript (truncate strategy).
     * Keeps only the last N messages (2x defaultRetrievalCount).
     */
    async compact(sessionId: string): Promise<{ before: number; after: number }> {
        const keepCount = this.config.defaultRetrievalCount * 2;
        const messages = await this.getRecentMessages(sessionId, keepCount);

        const filePath = this.getSessionFilePath(sessionId);
        const archivePath = `${filePath}.archive.${Date.now()}`;

        // Archive old file
        try {
            if (fs.existsSync(filePath)) {
                fs.renameSync(filePath, archivePath);
            }
        } catch {
            // best effort archive
        }

        // Write compaction marker + kept messages
        const compactionEntry: TranscriptEntry = {
            type: 'compaction',
            timestamp: Date.now(),
            summary: `Compacted: kept ${messages.length} most recent messages`,
        };
        fs.writeFileSync(filePath, JSON.stringify(compactionEntry) + '\n', { encoding: 'utf-8' });

        for (const msg of messages) {
            fs.appendFileSync(filePath, JSON.stringify(msg) + '\n', { encoding: 'utf-8' });
        }

        const beforeStat = fs.existsSync(archivePath) ? fs.statSync(archivePath).size : 0;
        const afterStat = fs.statSync(filePath).size;

        return { before: beforeStat, after: afterStat };
    }

    /**
     * List all session IDs with transcripts.
     */
    listSessions(): string[] {
        try {
            return fs.readdirSync(this.config.storeDir)
                .filter(f => f.endsWith('.jsonl') && !f.includes('.archive.'))
                .map(f => f.slice(0, -'.jsonl'.length));
        } catch {
            return [];
        }
    }

    /**
     * Delete a session transcript.
     */
    deleteSession(sessionId: string): boolean {
        const filePath = this.getSessionFilePath(sessionId);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
        } catch {
            // best effort
        }
        return false;
    }

    /**
     * Get file size for a session transcript.
     */
    getSessionFileSize(sessionId: string): number {
        const filePath = this.getSessionFilePath(sessionId);
        try {
            return fs.statSync(filePath).size;
        } catch {
            return 0;
        }
    }
}
