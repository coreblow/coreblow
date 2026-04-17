/**
 * extensions/context-pruning.ts
 * Context pruning extension — manages conversation context limits.
 * Ported from CoreBlow reference src/agents/pi-extensions/context-pruning/.
 */

export interface PruningSettings {
    maxContextTokens: number;
    reserveTokens: number;
    strategy: 'sliding-window' | 'summarize' | 'selective';
    preserveSystemMessages: boolean;
    preserveRecentCount: number;
}

const DEFAULT_SETTINGS: PruningSettings = {
    maxContextTokens: 128_000,
    reserveTokens: 4096,
    strategy: 'sliding-window',
    preserveSystemMessages: true,
    preserveRecentCount: 5,
};

export interface PruningResult {
    original: number;
    pruned: number;
    removed: number;
    strategy: string;
}

/**
 * Resolve pruning settings from config.
 */
export function resolvePruningSettings(cfg?: Record<string, unknown>): PruningSettings {
    const ext = cfg?.extensions as Record<string, unknown> | undefined;
    const pruning = ext?.contextPruning as Record<string, unknown> | undefined;
    if (!pruning) return { ...DEFAULT_SETTINGS };

    return {
        maxContextTokens: typeof pruning.maxContextTokens === 'number' ? pruning.maxContextTokens : DEFAULT_SETTINGS.maxContextTokens,
        reserveTokens: typeof pruning.reserveTokens === 'number' ? pruning.reserveTokens : DEFAULT_SETTINGS.reserveTokens,
        strategy: resolveStrategy(pruning.strategy) ?? DEFAULT_SETTINGS.strategy,
        preserveSystemMessages: typeof pruning.preserveSystemMessages === 'boolean' ? pruning.preserveSystemMessages : DEFAULT_SETTINGS.preserveSystemMessages,
        preserveRecentCount: typeof pruning.preserveRecentCount === 'number' ? pruning.preserveRecentCount : DEFAULT_SETTINGS.preserveRecentCount,
    };
}

function resolveStrategy(raw: unknown): PruningSettings['strategy'] | null {
    if (raw === 'sliding-window' || raw === 'summarize' || raw === 'selective') return raw;
    return null;
}

/**
 * Estimate token count (4 chars ≈ 1 token).
 */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Prune messages using sliding window strategy.
 */
export function pruneContextSlidingWindow(
    messages: Array<{ role: string; content: string }>,
    settings: PruningSettings,
): { messages: Array<{ role: string; content: string }>; result: PruningResult } {
    const budget = settings.maxContextTokens - settings.reserveTokens;
    const original = messages.length;

    // Always keep system messages and recent messages
    const system = settings.preserveSystemMessages ? messages.filter((m) => m.role === 'system') : [];
    const nonSystem = messages.filter((m) => m.role !== 'system');
    const recent = nonSystem.slice(-settings.preserveRecentCount);
    const middle = nonSystem.slice(0, -settings.preserveRecentCount);

    // Calculate budget used by system + recent
    const fixedTokens = [...system, ...recent].reduce((sum, m) => sum + estimateTokens(m.content), 0);
    let remainingBudget = budget - fixedTokens;

    // Include as many middle messages as fit (from newest to oldest)
    const kept: Array<{ role: string; content: string }> = [];
    for (let i = middle.length - 1; i >= 0; i--) {
        const tokens = estimateTokens(middle[i].content);
        if (remainingBudget - tokens >= 0) {
            kept.unshift(middle[i]);
            remainingBudget -= tokens;
        }
    }

    const pruned = [...system, ...kept, ...recent];
    return {
        messages: pruned,
        result: { original, pruned: pruned.length, removed: original - pruned.length, strategy: 'sliding-window' },
    };
}
