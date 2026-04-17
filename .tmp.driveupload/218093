/**
 * CoreBlow — Context Compaction Engine (CoreBlow Parity)
 *
 * Handles intelligent compaction of conversation history to prevent
 * unbounded context growth in long-running agent sessions.
 *
 * Compaction strategies:
 *  1. Sliding Window — keep only the last N turns
 *  2. Summary Compaction — replace old turns with a concise summary
 *  3. Importance-Based — score messages and keep only high-importance ones
 *  4. Hybrid — combine strategies for optimal context retention
 *
 * Safety:
 *  - Compaction safeguard: never remove system prompt
 *  - Quality check: verify summary captures key information
 *  - Timeout: abort compaction if it takes too long
 */

// ─── Types ──────────────────────────────────────────────────────

export interface CompactionMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    timestamp?: number;
    importance?: number; // 0.0 (low) to 1.0 (critical)
    pinned?: boolean;
    toolName?: string;
    toolCallId?: string;
}

export type CompactionStrategy = 'sliding_window' | 'summary' | 'importance' | 'hybrid';

export interface CompactionConfig {
    /** Strategy to use */
    strategy: CompactionStrategy;
    /** For sliding_window: number of recent turns to keep */
    windowSize?: number;
    /** For importance: minimum importance score to keep (0.0–1.0) */
    importanceThreshold?: number;
    /** Maximum time allowed for compaction (ms) */
    timeoutMs?: number;
    /** Whether to preserve tool call results */
    preserveToolCalls?: boolean;
    /** Custom summarizer function (for LLM-based summary) */
    summarizer?: (messages: CompactionMessage[]) => Promise<string>;
}

export interface CompactionResult {
    /** Messages after compaction */
    messages: CompactionMessage[];
    /** Number of messages before compaction */
    originalCount: number;
    /** Number of messages after compaction */
    finalCount: number;
    /** Messages removed */
    removedCount: number;
    /** Strategy used */
    strategy: CompactionStrategy;
    /** Whether a summary was generated */
    hasSummary: boolean;
    /** Time taken (ms) */
    durationMs: number;
}

// ─── Compaction Engine ──────────────────────────────────────────

export class CompactionEngine {
    private config: Required<CompactionConfig>;
    private totalCompactions = 0;
    private totalRemoved = 0;

    constructor(config: Partial<CompactionConfig> = {}) {
        this.config = {
            strategy: config.strategy ?? 'hybrid',
            windowSize: config.windowSize ?? 20,
            importanceThreshold: config.importanceThreshold ?? 0.3,
            timeoutMs: config.timeoutMs ?? 5000,
            preserveToolCalls: config.preserveToolCalls ?? true,
            summarizer: config.summarizer ?? defaultSummarizer,
        };
    }

    /**
     * Compact messages using the configured strategy.
     */
    async compact(messages: CompactionMessage[]): Promise<CompactionResult> {
        const start = Date.now();
        const originalCount = messages.length;

        // Safety: never compact if too few messages
        if (messages.length <= 4) {
            return {
                messages,
                originalCount,
                finalCount: messages.length,
                removedCount: 0,
                strategy: this.config.strategy,
                hasSummary: false,
                durationMs: Date.now() - start,
            };
        }

        let result: CompactionMessage[];
        let hasSummary = false;

        // Apply timeout safeguard
        const timeoutPromise = new Promise<null>((resolve) =>
            setTimeout(() => resolve(null), this.config.timeoutMs)
        );

        try {
            switch (this.config.strategy) {
                case 'sliding_window':
                    result = this.slidingWindow(messages);
                    break;
                case 'summary': {
                    const summaryResult = await Promise.race([
                        this.summaryCompaction(messages),
                        timeoutPromise,
                    ]);
                    if (summaryResult === null) {
                        // Timeout — fall back to sliding window
                        result = this.slidingWindow(messages);
                    } else {
                        result = summaryResult;
                        hasSummary = true;
                    }
                    break;
                }
                case 'importance':
                    result = this.importanceBased(messages);
                    break;
                case 'hybrid':
                default: {
                    const hybridResult = await Promise.race([
                        this.hybridCompaction(messages),
                        timeoutPromise,
                    ]);
                    if (hybridResult === null) {
                        result = this.slidingWindow(messages);
                    } else {
                        result = hybridResult.messages;
                        hasSummary = hybridResult.hasSummary;
                    }
                    break;
                }
            }
        } catch {
            // Compaction failed — return original with sliding window as safe fallback
            result = this.slidingWindow(messages);
        }

        const removedCount = originalCount - result.length;
        this.totalCompactions++;
        this.totalRemoved += removedCount;

        return {
            messages: result,
            originalCount,
            finalCount: result.length,
            removedCount,
            strategy: this.config.strategy,
            hasSummary,
            durationMs: Date.now() - start,
        };
    }

    // ─── Strategies ─────────────────────────────────────────────

    /**
     * Sliding Window: Keep system messages + last N messages.
     */
    private slidingWindow(messages: CompactionMessage[]): CompactionMessage[] {
        const system = messages.filter(m => m.role === 'system' || m.pinned);
        const nonSystem = messages.filter(m => m.role !== 'system' && !m.pinned);

        const kept = nonSystem.slice(-this.config.windowSize);
        return [...system, ...kept];
    }

    /**
     * Summary Compaction: Summarize old messages, keep recent ones.
     */
    private async summaryCompaction(messages: CompactionMessage[]): Promise<CompactionMessage[]> {
        const system = messages.filter(m => m.role === 'system');
        const nonSystem = messages.filter(m => m.role !== 'system');

        // Keep the last windowSize/2 messages as-is
        const keepCount = Math.max(4, Math.floor(this.config.windowSize / 2));
        const oldMessages = nonSystem.slice(0, -keepCount);
        const recentMessages = nonSystem.slice(-keepCount);

        if (oldMessages.length === 0) {
            return messages;
        }

        // Generate summary of old messages
        const summary = await this.config.summarizer(oldMessages);

        const summaryMessage: CompactionMessage = {
            role: 'assistant',
            content: summary,
            pinned: true,
            importance: 0.9,
        };

        return [...system, summaryMessage, ...recentMessages];
    }

    /**
     * Importance-Based: Keep messages above importance threshold.
     */
    private importanceBased(messages: CompactionMessage[]): CompactionMessage[] {
        const scored = messages.map(msg => ({
            msg,
            score: msg.importance ?? this.autoScoreImportance(msg),
        }));

        return scored
            .filter(({ msg, score }) =>
                msg.role === 'system' ||
                msg.pinned ||
                score >= this.config.importanceThreshold
            )
            .map(({ msg }) => msg);
    }

    /**
     * Hybrid: Importance scoring + summary for removed messages.
     */
    private async hybridCompaction(
        messages: CompactionMessage[],
    ): Promise<{ messages: CompactionMessage[]; hasSummary: boolean }> {
        // Step 1: Score all messages
        const scored = messages.map(msg => ({
            msg,
            score: msg.importance ?? this.autoScoreImportance(msg),
        }));

        // Step 2: Separate important and unimportant
        const important = scored.filter(({ msg, score }) =>
            msg.role === 'system' || msg.pinned || score >= this.config.importanceThreshold
        );
        const unimportant = scored.filter(({ msg, score }) =>
            msg.role !== 'system' && !msg.pinned && score < this.config.importanceThreshold
        );

        if (unimportant.length === 0) {
            return { messages, hasSummary: false };
        }

        // Step 3: Summarize unimportant messages
        const summary = await this.config.summarizer(unimportant.map(u => u.msg));

        const summaryMessage: CompactionMessage = {
            role: 'assistant',
            content: summary,
            pinned: true,
            importance: 0.8,
        };

        // Step 4: Reconstruct — system first, then summary, then important (time-ordered)
        const systemMsgs = important.filter(i => i.msg.role === 'system').map(i => i.msg);
        const otherImportant = important.filter(i => i.msg.role !== 'system').map(i => i.msg);

        return {
            messages: [...systemMsgs, summaryMessage, ...otherImportant],
            hasSummary: true,
        };
    }

    // ─── Auto-Scoring ───────────────────────────────────────────

    /**
     * Auto-score message importance based on heuristics.
     */
    private autoScoreImportance(msg: CompactionMessage): number {
        let score = 0.5; // Base score

        // System messages are always important
        if (msg.role === 'system') return 1.0;

        // Pinned messages
        if (msg.pinned) return 1.0;

        // Tool calls are moderately important
        if (msg.role === 'tool') {
            score += 0.2;
            if (this.config.preserveToolCalls) score += 0.2;
        }

        // Recency boost (recent messages more important)
        if (msg.timestamp) {
            const age = Date.now() - msg.timestamp;
            const fiveMinutes = 5 * 60 * 1000;
            if (age < fiveMinutes) score += 0.3;
            else if (age < 30 * 60 * 1000) score += 0.1;
        }

        // Content-based scoring
        const content = msg.content.toLowerCase();

        // Error messages are important
        if (content.includes('error') || content.includes('failed') || content.includes('exception')) {
            score += 0.2;
        }

        // Code blocks are important
        if (content.includes('```')) score += 0.15;

        // Very short messages are less important
        if (msg.content.length < 20) score -= 0.2;

        // Very long messages are slightly more important (contain detail)
        if (msg.content.length > 1000) score += 0.1;

        return Math.max(0, Math.min(1, score));
    }

    // ─── Stats ──────────────────────────────────────────────────

    stats(): { totalCompactions: number; totalRemoved: number } {
        return {
            totalCompactions: this.totalCompactions,
            totalRemoved: this.totalRemoved,
        };
    }
}

// ─── Default Summarizer ─────────────────────────────────────────

async function defaultSummarizer(messages: CompactionMessage[]): Promise<string> {
    // Local summarizer (no LLM call) — extracts key points
    const parts: string[] = [
        `[Conversation Summary — ${messages.length} messages compacted]`,
        '',
    ];

    const byRole: Record<string, string[]> = {};
    for (const msg of messages) {
        const role = msg.role;
        if (!byRole[role]) byRole[role] = [];
        // Take first 150 chars of each message
        const preview = msg.content.slice(0, 150).replace(/\n/g, ' ');
        byRole[role]!.push(preview + (msg.content.length > 150 ? '...' : ''));
    }

    for (const [role, contents] of Object.entries(byRole)) {
        parts.push(`### ${role} (${contents.length} messages)`);
        // Keep max 5 previews per role
        for (const content of contents.slice(0, 5)) {
            parts.push(`- ${content}`);
        }
        if (contents.length > 5) {
            parts.push(`- ... and ${contents.length - 5} more`);
        }
        parts.push('');
    }

    return parts.join('\n');
}

// ─── Compaction Safeguard ───────────────────────────────────────

/**
 * Validates that compaction didn't remove critical messages.
 */
export function validateCompaction(
    original: CompactionMessage[],
    compacted: CompactionMessage[],
): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check system message preserved
    const hadSystem = original.some(m => m.role === 'system');
    const hasSystem = compacted.some(m => m.role === 'system');
    if (hadSystem && !hasSystem) {
        issues.push('System message was removed during compaction');
    }

    // Check pinned messages preserved
    const pinnedOriginal = original.filter(m => m.pinned).length;
    const pinnedCompacted = compacted.filter(m => m.pinned).length;
    if (pinnedCompacted < pinnedOriginal) {
        issues.push(`${pinnedOriginal - pinnedCompacted} pinned messages were removed`);
    }

    // Check not empty
    if (compacted.length === 0 && original.length > 0) {
        issues.push('Compaction removed all messages');
    }

    // Check at least one non-system message remains
    if (original.length > 1 && compacted.filter(m => m.role !== 'system').length === 0) {
        issues.push('No non-system messages remain after compaction');
    }

    return { valid: issues.length === 0, issues };
}
