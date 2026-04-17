/**
 * agents/failover-error.ts — Error classification for failover.
 */
export type FailoverErrorKind = 'rate_limit' | 'overloaded' | 'auth' | 'network' | 'timeout' | 'context_length' | 'unknown';
export function classifyFailoverError(error: unknown): FailoverErrorKind {
    const msg = error instanceof Error ? error.message : String(error);
    if (/rate.?limit|429/i.test(msg)) return 'rate_limit';
    if (/overloaded|503|529/i.test(msg)) return 'overloaded';
    if (/auth|401|403|invalid.*key/i.test(msg)) return 'auth';
    if (/timeout|ETIMEDOUT|ECONNREFUSED/i.test(msg)) return 'timeout';
    if (/network|ENETUNREACH|ENOTFOUND/i.test(msg)) return 'network';
    if (/context.*length|too.*long|max.*tokens/i.test(msg)) return 'context_length';
    return 'unknown';
}
export function isRetryableError(kind: FailoverErrorKind): boolean { return kind === 'rate_limit' || kind === 'overloaded' || kind === 'timeout' || kind === 'network'; }
export function isFailoverEligible(kind: FailoverErrorKind): boolean { return kind !== 'context_length' && kind !== 'auth'; }

/**
 * agents/apply-patch-update.ts — Apply patch/diff to files.
 */
export function applyPatch(original: string, patch: string): string {
    const lines = original.split('\n');
    const patchLines = patch.split('\n');
    const result: string[] = [...lines];
    for (const line of patchLines) {
        if (line.startsWith('+') && !line.startsWith('+++')) result.push(line.slice(1));
    }
    return result.join('\n');
}
export function createSimpleDiff(before: string, after: string): string {
    const a = before.split('\n'), b = after.split('\n');
    const lines: string[] = [];
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
        if (a[i] !== b[i]) { if (a[i] !== undefined) lines.push(`-${a[i]}`); if (b[i] !== undefined) lines.push(`+${b[i]}`); }
        else if (a[i] !== undefined) lines.push(` ${a[i]}`);
    }
    return lines.join('\n');
}
