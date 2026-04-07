/**
 * CoreBlow — Context Manager
 *
 * Manages the agent's context window efficiently, including
 * token counting, context truncation, priority-based message
 * retention, and sliding window strategies.
 */

/** Context message */
export interface ContextMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tokens: number;
    priority: number;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

/** Context stats */
export interface ContextStats {
    totalMessages: number;
    totalTokens: number;
    maxTokens: number;
    utilization: number;
    systemTokens: number;
    userTokens: number;
    assistantTokens: number;
}

/**
 * CoreBlow Context Manager
 */
export class ContextManager {
    private messages: ContextMessage[] = [];
    private maxTokens: number;
    private reservedTokens: number;

    constructor(maxTokens: number = 128_000, reservedForResponse: number = 4096) {
        this.maxTokens = maxTokens;
        this.reservedTokens = reservedForResponse;
    }

    /**
     * Add a message to context.
     */
    add(role: ContextMessage['role'], content: string, priority: number = 5, metadata?: Record<string, unknown>): void {
        const tokens = this.estimateTokens(content);
        this.messages.push({ role, content, tokens, priority, timestamp: Date.now(), metadata });
        this.trim();
    }

    /**
     * Get current context as messages.
     */
    getMessages(): Array<{ role: string; content: string }> {
        return this.messages.map((m) => ({ role: m.role, content: m.content }));
    }

    /**
     * Get total tokens in context.
     */
    getTotalTokens(): number {
        return this.messages.reduce((sum, m) => sum + m.tokens, 0);
    }

    /**
     * Get available tokens for response.
     */
    getAvailableTokens(): number {
        return Math.max(0, this.maxTokens - this.getTotalTokens() - this.reservedTokens);
    }

    /**
     * Get context stats.
     */
    getStats(): ContextStats {
        const total = this.getTotalTokens();
        return {
            totalMessages: this.messages.length,
            totalTokens: total,
            maxTokens: this.maxTokens,
            utilization: total / this.maxTokens,
            systemTokens: this.messages.filter((m) => m.role === 'system').reduce((s, m) => s + m.tokens, 0),
            userTokens: this.messages.filter((m) => m.role === 'user').reduce((s, m) => s + m.tokens, 0),
            assistantTokens: this.messages.filter((m) => m.role === 'assistant').reduce((s, m) => s + m.tokens, 0),
        };
    }

    /**
     * Summarize and compact old messages.
     */
    compact(summaryContent: string): void {
        if (this.messages.length <= 2) return;
        const system = this.messages.filter((m) => m.role === 'system');
        const recent = this.messages.slice(-2);
        const summaryMsg: ContextMessage = {
            role: 'system', content: `Previous conversation summary: ${summaryContent}`,
            tokens: this.estimateTokens(summaryContent), priority: 8, timestamp: Date.now(),
        };
        this.messages = [...system, summaryMsg, ...recent];
    }

    /**
     * Clear all non-system messages.
     */
    clearHistory(): void {
        this.messages = this.messages.filter((m) => m.role === 'system');
    }

    /**
     * Clear everything.
     */
    reset(): void {
        this.messages = [];
    }

    /** Message count */
    count(): number { return this.messages.length; }

    // === Private ===

    private trim(): void {
        const limit = this.maxTokens - this.reservedTokens;
        while (this.getTotalTokens() > limit && this.messages.length > 1) {
            // Find lowest-priority non-system message
            let lowestIdx = -1;
            let lowestPriority = Infinity;
            for (let i = 0; i < this.messages.length; i++) {
                const m = this.messages[i]!;
                if (m.role === 'system') continue;
                if (m.priority < lowestPriority) {
                    lowestPriority = m.priority;
                    lowestIdx = i;
                }
            }
            if (lowestIdx === -1) break;
            this.messages.splice(lowestIdx, 1);
        }
    }

    /**
     * Estimate token count (~4 chars per token).
     */
    estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }
}
