/**
 * agents/transcript-policy.ts
 * Transcript storage policy — what to persist, what to redact.
 */
export type TranscriptLevel = 'full' | 'summary' | 'metadata_only' | 'none';
export interface TranscriptPolicy { level: TranscriptLevel; redactToolResults?: boolean; maxMessageLength?: number; excludeRoles?: string[]; }
const DEFAULT_POLICY: TranscriptPolicy = { level: 'full', redactToolResults: false, maxMessageLength: 50_000 };
export function resolveTranscriptPolicy(overrides?: Partial<TranscriptPolicy>): TranscriptPolicy { return { ...DEFAULT_POLICY, ...overrides }; }
export function shouldStoreMessage(policy: TranscriptPolicy, role: string): boolean {
    if (policy.level === 'none') return false;
    if (policy.excludeRoles?.includes(role)) return false;
    return true;
}
export function truncateForTranscript(content: string, policy: TranscriptPolicy): string {
    const max = policy.maxMessageLength ?? 50_000;
    return content.length <= max ? content : content.slice(0, max) + `\n[truncated: ${content.length - max} chars]`;
}
