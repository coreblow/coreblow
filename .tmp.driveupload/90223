/**
 * context-engine/types.ts
 * Shared type definitions for the context engine.
 */

/** A single entry in the conversation context. */
export interface ContextEntry {
    /** Message role: system, user, assistant, tool */
    role: string;
    /** Text content of the entry */
    content: string;
    /** Token count for this entry */
    tokens: number;
    /** Optional timestamp */
    timestamp?: number;
    /** Optional tool call ID */
    toolCallId?: string;
    /** Optional name (for tool results) */
    name?: string;
}

/** A context window holding conversation history for one session. */
export interface ContextWindow {
    /** Ordered conversation entries (excludes system prompt) */
    entries: ContextEntry[];
    /** System prompt, stored separately for priority retention */
    systemPrompt: ContextEntry | null;
    /** Maximum token budget */
    maxTokens: number;
    /** Current total token count (entries + system prompt) */
    currentTokens: number;
    /** Model identifier */
    model: string;
}

/** A strategy for compacting context when it exceeds the token budget. */
export interface ContextStrategy {
    /** Strategy name for logging */
    name: string;
    /** Compact the window, returning the entries to keep (excluding system prompt). */
    compact(window: ContextWindow): ContextEntry[];
}

/** Result of a context search query. */
export interface ContextSearchResult {
    /** The matched entry */
    entry: ContextEntry;
    /** Relevance score */
    score: number;
    /** Original index in entries array */
    index: number;
}
