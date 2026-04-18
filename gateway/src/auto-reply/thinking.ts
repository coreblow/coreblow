/**
 * auto-reply/thinking.ts
 * Thinking status and reasoning level management.
 * Ported from CoreBlow src/auto-reply/thinking.ts.
 */

export type ThinkLevel = 'none' | 'low' | 'medium' | 'high' | 'max';
export type ReasoningLevel = ThinkLevel;
export type ElevatedLevel = 'standard' | 'elevated';
export type ElevatedMode = 'auto' | 'always' | 'never';
export type VerboseLevel = 'off' | 'brief' | 'full';
export type NoticeLevel = 'off' | 'on';
export type UsageDisplayLevel = 'off' | 'brief' | 'full';

export interface ThinkingCatalogEntry {
    level: ThinkLevel;
    label: string;
    description: string;
    tokenBudget?: number;
}

const THINKING_CATALOG: ThinkingCatalogEntry[] = [
    { level: 'none', label: 'None', description: 'No thinking/reasoning tokens' },
    { level: 'low', label: 'Low', description: 'Minimal thinking tokens', tokenBudget: 1024 },
    { level: 'medium', label: 'Medium', description: 'Moderate thinking tokens', tokenBudget: 4096 },
    { level: 'high', label: 'High', description: 'Extended thinking tokens', tokenBudget: 16384 },
    { level: 'max', label: 'Max', description: 'Maximum thinking tokens', tokenBudget: 65536 },
];

export function normalizeThinkLevel(raw?: string | null): ThinkLevel | undefined {
    const v = raw?.trim().toLowerCase();
    if (v === 'none' || v === 'off' || v === '0') return 'none';
    if (v === 'low' || v === 'min' || v === '1') return 'low';
    if (v === 'medium' || v === 'med' || v === '2') return 'medium';
    if (v === 'high' || v === '3') return 'high';
    if (v === 'max' || v === 'xhigh' || v === '4') return 'max';
    return undefined;
}

export function normalizeReasoningLevel(raw?: string | null): ReasoningLevel | undefined {
    return normalizeThinkLevel(raw);
}

export function normalizeElevatedLevel(raw?: string | null): ElevatedLevel | undefined {
    const v = raw?.trim().toLowerCase();
    if (v === 'standard' || v === 'normal') return 'standard';
    if (v === 'elevated' || v === 'high') return 'elevated';
    return undefined;
}

export function normalizeVerboseLevel(raw?: string | null): VerboseLevel | undefined {
    const v = raw?.trim().toLowerCase();
    if (v === 'off' || v === 'none') return 'off';
    if (v === 'brief' || v === 'short') return 'brief';
    if (v === 'full' || v === 'verbose') return 'full';
    return undefined;
}

export function normalizeUsageDisplay(raw?: string | null): UsageDisplayLevel | undefined {
    const v = raw?.trim().toLowerCase();
    if (v === 'off' || v === 'none') return 'off';
    if (v === 'brief' || v === 'short') return 'brief';
    if (v === 'full' || v === 'verbose') return 'full';
    return undefined;
}

export function normalizeFastMode(raw?: string | null): boolean | undefined {
    const v = raw?.trim().toLowerCase();
    if (v === 'true' || v === 'on' || v === '1') return true;
    if (v === 'false' || v === 'off' || v === '0') return false;
    return undefined;
}

export function listThinkingLevels(): ThinkingCatalogEntry[] {
    return [...THINKING_CATALOG];
}

export function formatThinkingLevels(): string {
    return THINKING_CATALOG.map((e) => `  ${e.level}: ${e.description}`).join('\n');
}

/**
 * Check if a provider only supports binary thinking (on/off vs levels).
 */
export function isBinaryThinkingProvider(provider?: string | null): boolean {
    const p = provider?.trim().toLowerCase();
    if (!p) return false;
    const binary = ['anthropic', 'claude', 'deepseek'];
    return binary.some((b) => p.includes(b));
}

/**
 * Resolve the default thinking level for a model.
 */
export function resolveThinkingDefaultForModel(model?: string | null): ThinkLevel {
    if (!model) return 'none';
    const m = model.toLowerCase();
    if (m.includes('o1') || m.includes('o3')) return 'high';
    if (m.includes('claude-3-5') || m.includes('claude-4')) return 'medium';
    if (m.includes('gemini-2.5')) return 'medium';
    return 'none';
}

/**
 * Resolve token budget for a thinking level.
 */
export function resolveThinkingTokenBudget(level: ThinkLevel): number | undefined {
    return THINKING_CATALOG.find((e) => e.level === level)?.tokenBudget;
}
