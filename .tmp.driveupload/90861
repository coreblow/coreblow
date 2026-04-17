/**
 * agents/anthropic-payload-log.ts
 * Log/redact Anthropic API payloads for debugging.
 */
import { redactPayload } from './payload-redaction.js';
export function logAnthropicPayload(direction: 'request' | 'response', payload: unknown, opts?: { redact?: boolean }): Record<string, unknown> {
    const safe = opts?.redact !== false ? redactPayload(payload) : payload;
    return { direction, timestamp: Date.now(), payload: safe } as Record<string, unknown>;
}
export function extractAnthropicUsage(response: Record<string, unknown>): { inputTokens: number; outputTokens: number } | null {
    const usage = response.usage as Record<string, number> | undefined;
    if (!usage) return null;
    return { inputTokens: usage.input_tokens ?? 0, outputTokens: usage.output_tokens ?? 0 };
}
