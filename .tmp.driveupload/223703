/**
 * config/allowed-values.ts
 * Enum validation and allowed value summarization.
 * Ported from CoreBlow reference src/config/allowed-values.ts.
 */

const MAX_ALLOWED_VALUES_HINT = 12;
const MAX_ALLOWED_VALUE_CHARS = 160;

export type AllowedValuesSummary = {
    values: string[];
    hiddenCount: number;
    formatted: string;
};

function truncateHintText(text: string, limit: number): string {
    if (text.length <= limit) return text;
    return `${text.slice(0, limit)}... (+${text.length - limit} chars)`;
}

function safeStringify(value: unknown): string {
    try {
        const serialized = JSON.stringify(value);
        if (serialized !== undefined) return serialized;
    } catch { /* fallback */ }
    return String(value);
}

function toAllowedValueLabel(value: unknown): string {
    if (typeof value === 'string') return JSON.stringify(truncateHintText(value, MAX_ALLOWED_VALUE_CHARS));
    return truncateHintText(safeStringify(value), MAX_ALLOWED_VALUE_CHARS);
}

function toAllowedValueDedupKey(value: unknown): string {
    if (value === null) return 'null:null';
    const kind = typeof value;
    if (kind === 'string') return `string:${value as string}`;
    return `${kind}:${safeStringify(value)}`;
}

export function summarizeAllowedValues(values: ReadonlyArray<unknown>): AllowedValuesSummary | null {
    if (values.length === 0) return null;

    const deduped: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();
    for (const item of values) {
        const key = toAllowedValueDedupKey(item);
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push({ value: typeof item === 'string' ? item : safeStringify(item), label: toAllowedValueLabel(item) });
    }

    const shown = deduped.slice(0, MAX_ALLOWED_VALUES_HINT);
    const hiddenCount = deduped.length - shown.length;
    const formattedCore = shown.map((entry) => entry.label).join(', ');
    const formatted = hiddenCount > 0 ? `${formattedCore}, ... (+${hiddenCount} more)` : formattedCore;

    return { values: deduped.map((d) => d.value), hiddenCount, formatted };
}

// ─── CoreBlow Config Enums ────────────────────────────────────────

export const AUTO_REPLY_MODES = ['always', 'mention', 'reply', 'never'] as const;
export type AutoReplyMode = (typeof AUTO_REPLY_MODES)[number];

export const SANDBOX_MODES = ['off', 'non-main', 'all'] as const;
export type SandboxMode = (typeof SANDBOX_MODES)[number];

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const TOOL_APPROVAL_MODES = ['off', 'on-miss', 'always'] as const;
export type ToolApprovalMode = (typeof TOOL_APPROVAL_MODES)[number];

export const CHANNEL_IDS = ['discord', 'telegram', 'slack', 'signal', 'gmail', 'whatsapp', 'imessage'] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

export function isValidAutoReplyMode(value: unknown): value is AutoReplyMode {
    return typeof value === 'string' && (AUTO_REPLY_MODES as readonly string[]).includes(value);
}

export function isValidSandboxMode(value: unknown): value is SandboxMode {
    return typeof value === 'string' && (SANDBOX_MODES as readonly string[]).includes(value);
}

export function isValidLogLevel(value: unknown): value is LogLevel {
    return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value);
}

export function isValidChannelId(value: unknown): value is ChannelId {
    return typeof value === 'string' && (CHANNEL_IDS as readonly string[]).includes(value);
}
