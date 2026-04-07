/**
 * CoreBlow — Conversation Memory Store
 *
 * Persistent conversation storage with session management,
 * message history, summarization triggers, search, and
 * retention policies. Supports both in-memory and file-backed storage.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

/** Stored message */
export interface StoredMessage {
    id: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
    tokenCount?: number;
}

/** Conversation record */
export interface Conversation {
    id: string;
    title?: string;
    messages: StoredMessage[];
    createdAt: number;
    updatedAt: number;
    summary?: string;
    metadata?: Record<string, unknown>;
    tags?: string[];
}

/** Memory store options */
export interface MemoryStoreOptions {
    /** Directory for file-backed persistence */
    persistDir?: string;
    /** Maximum messages per conversation before summarization */
    maxMessages?: number;
    /** Maximum conversations to keep */
    maxConversations?: number;
    /** Summarization callback */
    summarizer?: (messages: StoredMessage[]) => Promise<string>;
}

/**
 * CoreBlow Conversation Memory Store
 */
export class MemoryStore {
    private conversations = new Map<string, Conversation>();
    private options: Required<MemoryStoreOptions>;

    constructor(opts?: MemoryStoreOptions) {
        this.options = {
            persistDir: opts?.persistDir ?? '',
            maxMessages: opts?.maxMessages ?? 200,
            maxConversations: opts?.maxConversations ?? 1000,
            summarizer: opts?.summarizer ?? (async (msgs) => `Summary of ${msgs.length} messages`),
        };

        if (this.options.persistDir) this.loadFromDisk();
    }

    /** Create a new conversation */
    create(title?: string, metadata?: Record<string, unknown>): Conversation {
        const conv: Conversation = {
            id: crypto.randomBytes(8).toString('hex'),
            title,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            metadata,
        };
        this.conversations.set(conv.id, conv);
        this.enforceLimit();
        return conv;
    }

    /** Add a message to a conversation */
    addMessage(conversationId: string, role: StoredMessage['role'], content: string, metadata?: Record<string, unknown>): StoredMessage | null {
        const conv = this.conversations.get(conversationId);
        if (!conv) return null;

        const msg: StoredMessage = {
            id: crypto.randomBytes(6).toString('hex'),
            role,
            content,
            timestamp: Date.now(),
            metadata,
        };

        conv.messages.push(msg);
        conv.updatedAt = Date.now();

        if (this.options.persistDir) this.saveToDisk(conv);
        return msg;
    }

    /** Get a conversation by ID */
    get(conversationId: string): Conversation | null {
        return this.conversations.get(conversationId) ?? null;
    }

    /** Get recent messages from a conversation */
    getMessages(conversationId: string, limit?: number): StoredMessage[] {
        const conv = this.conversations.get(conversationId);
        if (!conv) return [];
        return conv.messages.slice(-(limit ?? 50));
    }

    /** Search messages across all conversations */
    search(query: string, limit: number = 20): Array<{ conversationId: string; message: StoredMessage }> {
        const results: Array<{ conversationId: string; message: StoredMessage }> = [];
        const lower = query.toLowerCase();

        for (const conv of Array.from(this.conversations.values())) {
            for (const msg of conv.messages) {
                if (msg.content.toLowerCase().includes(lower)) {
                    results.push({ conversationId: conv.id, message: msg });
                    if (results.length >= limit) return results;
                }
            }
        }
        return results;
    }

    /** Summarize and compact a conversation */
    async summarize(conversationId: string): Promise<string | null> {
        const conv = this.conversations.get(conversationId);
        if (!conv || conv.messages.length === 0) return null;

        const summary = await this.options.summarizer(conv.messages);
        conv.summary = summary;
        conv.updatedAt = Date.now();

        if (this.options.persistDir) this.saveToDisk(conv);
        return summary;
    }

    /** List all conversations */
    list(limit: number = 50): Array<{ id: string; title?: string; messageCount: number; updatedAt: number }> {
        return Array.from(this.conversations.values())
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, limit)
            .map((c) => ({ id: c.id, title: c.title, messageCount: c.messages.length, updatedAt: c.updatedAt }));
    }

    /** Delete a conversation */
    delete(conversationId: string): boolean {
        return this.conversations.delete(conversationId);
    }

    /** Get total message count */
    getStats(): { conversations: number; totalMessages: number } {
        let totalMessages = 0;
        for (const conv of Array.from(this.conversations.values())) totalMessages += conv.messages.length;
        return { conversations: this.conversations.size, totalMessages };
    }

    // === Private ===

    private enforceLimit(): void {
        if (this.conversations.size > this.options.maxConversations) {
            const sorted = Array.from(this.conversations.entries())
                .sort((a, b) => a[1].updatedAt - b[1].updatedAt);
            const toRemove = sorted.slice(0, this.conversations.size - this.options.maxConversations);
            for (const [id] of toRemove) this.conversations.delete(id);
        }
    }

    private saveToDisk(conv: Conversation): void {
        try {
            const dir = this.options.persistDir;
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(path.join(dir, `${conv.id}.json`), JSON.stringify(conv, null, 2));
        } catch { /* skip */ }
    }

    private loadFromDisk(): void {
        try {
            const dir = this.options.persistDir;
            if (!fs.existsSync(dir)) return;
            for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
                const data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
                this.conversations.set(data.id, data);
            }
        } catch { /* skip */ }
    }
}
