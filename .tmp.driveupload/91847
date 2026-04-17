/**
 * extensions/compaction.ts
 * Conversation compaction (summary-based context reduction).
 * Ported from OpenClaw src/agents/pi-extensions/compaction-*.
 */

export interface CompactionConfig {
    enabled: boolean;
    triggerThresholdTokens: number;
    targetTokens: number;
    preserveRecentMessages: number;
    compactionPrompt: string;
    qualityCheck: boolean;
}

export interface CompactionResult {
    originalTokens: number;
    compactedTokens: number;
    summaryLength: number;
    preservedMessages: number;
    durationMs: number;
}

const DEFAULT_COMPACTION_PROMPT = `You are a conversation summarizer. Condense the following conversation into a concise summary that preserves:
1. Key decisions and conclusions
2. Important facts and context
3. User preferences and instructions
4. Any pending tasks or follow-ups

Be concise but thorough. Output ONLY the summary, no preamble.`;

const DEFAULT_CONFIG: CompactionConfig = {
    enabled: true,
    triggerThresholdTokens: 100_000,
    targetTokens: 16_000,
    preserveRecentMessages: 10,
    compactionPrompt: DEFAULT_COMPACTION_PROMPT,
    qualityCheck: true,
};

/**
 * Resolve compaction config.
 */
export function resolveCompactionConfig(cfg?: Record<string, unknown>): CompactionConfig {
    const ext = cfg?.extensions as Record<string, unknown> | undefined;
    const compaction = ext?.compaction as Record<string, unknown> | undefined;
    if (!compaction) return { ...DEFAULT_CONFIG };

    return {
        enabled: typeof compaction.enabled === 'boolean' ? compaction.enabled : DEFAULT_CONFIG.enabled,
        triggerThresholdTokens: typeof compaction.triggerThresholdTokens === 'number' ? compaction.triggerThresholdTokens : DEFAULT_CONFIG.triggerThresholdTokens,
        targetTokens: typeof compaction.targetTokens === 'number' ? compaction.targetTokens : DEFAULT_CONFIG.targetTokens,
        preserveRecentMessages: typeof compaction.preserveRecentMessages === 'number' ? compaction.preserveRecentMessages : DEFAULT_CONFIG.preserveRecentMessages,
        compactionPrompt: typeof compaction.compactionPrompt === 'string' ? compaction.compactionPrompt : DEFAULT_CONFIG.compactionPrompt,
        qualityCheck: typeof compaction.qualityCheck === 'boolean' ? compaction.qualityCheck : DEFAULT_CONFIG.qualityCheck,
    };
}

/**
 * Check if compaction should be triggered.
 */
export function shouldCompact(currentTokens: number, config: CompactionConfig): boolean {
    return config.enabled && currentTokens >= config.triggerThresholdTokens;
}

/**
 * Build the compaction messages for the LLM.
 */
export function buildCompactionMessages(params: {
    messages: Array<{ role: string; content: string }>;
    config: CompactionConfig;
}): { toCompact: Array<{ role: string; content: string }>; toPreserve: Array<{ role: string; content: string }> } {
    const { messages, config } = params;
    const system = messages.filter((m) => m.role === 'system');
    const nonSystem = messages.filter((m) => m.role !== 'system');
    const toPreserve = [...system, ...nonSystem.slice(-config.preserveRecentMessages)];
    const toCompact = nonSystem.slice(0, -config.preserveRecentMessages);
    return { toCompact, toPreserve };
}

/**
 * Validate compaction quality (summary should not be too short or too long).
 */
export function validateCompactionQuality(summary: string, originalTokens: number): { valid: boolean; reason?: string } {
    const summaryTokens = Math.ceil(summary.length / 4);
    if (summaryTokens < 50) return { valid: false, reason: 'Summary too short' };
    if (summaryTokens > originalTokens * 0.8) return { valid: false, reason: 'Summary not significantly shorter than original' };
    if (summary.trim().length === 0) return { valid: false, reason: 'Empty summary' };
    return { valid: true };
}
