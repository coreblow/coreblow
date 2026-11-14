/**
 * context-engine/context-window.ts
 * Context window manager — sliding window over conversation history.
 */

import { createChildLogger } from '../utils/logger.js';
import type { ContextEntry, ContextWindow, ContextStrategy } from './types.js';

const log = createChildLogger('context-window');

export class ContextWindowManager {
    private windows = new Map<string, ContextWindow>();

    /** Create a new context window. */
    create(sessionId: string, model: string, maxTokens = 128000): ContextWindow {
        const window: ContextWindow = {
            entries: [],
            systemPrompt: null,
            maxTokens,
            totalTokens: 0,
            currentTokens: 0,
            model,
        };
        this.windows.set(sessionId, window);
        return window;
    }

    /** Get or create a context window for a session. */
    getOrCreate(sessionId: string, model: string, maxTokens?: number): ContextWindow {
        return this.windows.get(sessionId) ?? this.create(sessionId, model, maxTokens);
    }

    /** Add an entry to the context window. */
    addEntry(sessionId: string, entry: ContextEntry): void {
        const window = this.windows.get(sessionId);
        if (!window) return;

        if (entry.role === 'system' && !window.systemPrompt) {
            window.systemPrompt = entry;
        } else {
            window.entries.push(entry);
        }

        const tokens = entry.tokens ?? 0;
        window.currentTokens = (window.currentTokens ?? 0) + tokens;
        window.totalTokens = window.currentTokens;

        // Auto-compact if over limit
        if (window.currentTokens > window.maxTokens * 0.9) {
            this.compact(sessionId);
        }
    }

    /** Compact context using a strategy. */
    compact(sessionId: string, strategy?: ContextStrategy): void {
        const window = this.windows.get(sessionId);
        if (!window) return;

        const activeStrategy = strategy ?? slidingWindowStrategy;
        const kept = activeStrategy.compact(window);

        window.entries = kept;
        const sysTokens = (typeof window.systemPrompt === "object" && window.systemPrompt ? (window.systemPrompt as ContextEntry).tokens : 0) ?? 0;
        const keptTokens = kept.reduce((sum: number, e: ContextEntry) => sum + (e.tokens ?? 0), 0);
        window.currentTokens = keptTokens + sysTokens;
        window.totalTokens = window.currentTokens;

        log.debug({ sessionId, tokens: window.currentTokens, entries: kept.length }, 'Context compacted');
    }

    /** Get the full context for sending to LLM. */
    getMessages(sessionId: string): ContextEntry[] {
        const window = this.windows.get(sessionId);
        if (!window) return [];

        const messages: ContextEntry[] = [];
        if (window.systemPrompt) {
            if (typeof window.systemPrompt === "object") {
                messages.push(window.systemPrompt as ContextEntry);
            } else {
                messages.push({ role: 'system', content: String(window.systemPrompt) });
            }
        }
        messages.push(...window.entries);
        return messages;
    }

    /** Remove a context window. */
    remove(sessionId: string): void {
        this.windows.delete(sessionId);
    }

    /** Get token count for a session. */
    getTokenCount(sessionId: string): number {
        return this.windows.get(sessionId)?.currentTokens ?? 0;
    }

    /** Get total windows. */
    get size(): number { return this.windows.size; }
}

// ─── Built-in Strategies ─────────────────────────────────────────

/** Keep most recent entries within budget. Always keeps system prompt + last N. */
const slidingWindowStrategy: ContextStrategy = {
    name: 'sliding-window',
    compact: (window: ContextWindow) => {
        const budget = window.maxTokens * 0.75;
        const sysTokens = (typeof window.systemPrompt === "object" && window.systemPrompt ? (window.systemPrompt as ContextEntry).tokens : 0) ?? 0;
        let totalTokens = sysTokens;
        const kept: ContextEntry[] = [];

        // Work backwards
        for (let i = window.entries.length - 1; i >= 0; i--) {
            const entry = window.entries[i];
            const tokens = entry.tokens ?? 0;
            if (totalTokens + tokens > budget) break;
            totalTokens += tokens;
            kept.unshift(entry);
        }

        return kept;
    },
};

/** Keep first + last entries, summarize middle. */
export const firstLastStrategy: ContextStrategy = {
    name: 'first-last',
    compact: (window: ContextWindow) => {
        if (window.entries.length <= 4) return window.entries;
        const first2 = window.entries.slice(0, 2);
        const last2 = window.entries.slice(-2);
        return [...first2, ...last2];
    },
};

// ─── Singleton ───────────────────────────────────────────────────

let defaultManager: ContextWindowManager | null = null;
export function getContextWindowManager(): ContextWindowManager {
    if (!defaultManager) defaultManager = new ContextWindowManager();
    return defaultManager;
}
