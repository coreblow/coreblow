/**
 * agents/failover-policy.ts
 * Model failover and cooldown policy.
 * Ported from CoreBlow src/agents/failover-policy.ts + failover-error.ts.
 */

export type FailoverReason = 'rate_limit' | 'timeout' | 'server_error' | 'context_overflow' | 'auth_error' | 'unknown';

export class FailoverError extends Error {
    readonly reason: FailoverReason;
    readonly retryAfterMs?: number;
    readonly provider?: string;
    readonly model?: string;

    constructor(params: { message: string; reason: FailoverReason; retryAfterMs?: number; provider?: string; model?: string }) {
        super(params.message);
        this.name = 'FailoverError';
        this.reason = params.reason;
        this.retryAfterMs = params.retryAfterMs;
        this.provider = params.provider;
        this.model = params.model;
    }
}

export function isFailoverError(err: unknown): err is FailoverError {
    return err instanceof FailoverError;
}

export function isTimeoutError(err: unknown): boolean {
    if (isFailoverError(err)) return err.reason === 'timeout';
    if (err instanceof Error) return /timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(err.message);
    return false;
}

export function isRateLimitError(err: unknown): boolean {
    if (isFailoverError(err)) return err.reason === 'rate_limit';
    if (err instanceof Error) return /429|rate.?limit|too.?many/i.test(err.message);
    return false;
}

export function isContextOverflowError(err: unknown): boolean {
    if (isFailoverError(err)) return err.reason === 'context_overflow';
    if (err instanceof Error) return /context.?length|max.?tokens|too.?long/i.test(err.message);
    return false;
}

export function coerceToFailoverError(err: unknown, defaults?: { provider?: string; model?: string }): FailoverError {
    if (isFailoverError(err)) return err;
    const message = err instanceof Error ? err.message : String(err);
    let reason: FailoverReason = 'unknown';
    let retryAfterMs: number | undefined;
    if (isRateLimitError(err)) { reason = 'rate_limit'; retryAfterMs = extractRetryAfterMs(err); }
    else if (isTimeoutError(err)) reason = 'timeout';
    else if (isContextOverflowError(err)) reason = 'context_overflow';
    else if (/401|403|auth/i.test(message)) reason = 'auth_error';
    else if (/5\d{2}|server|internal/i.test(message)) reason = 'server_error';
    return new FailoverError({ message, reason, retryAfterMs, ...defaults });
}

function extractRetryAfterMs(err: unknown): number | undefined {
    if (err && typeof err === 'object') {
        const headers = (err as Record<string, unknown>).headers as Record<string, string> | undefined;
        const retryAfter = headers?.['retry-after'];
        if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            if (!Number.isNaN(seconds)) return seconds * 1000;
        }
    }
    return undefined;
}

/** Cooldown entry for a model that hit rate limits. */
export interface CooldownEntry {
    model: string;
    provider: string;
    expiresAt: number;
    reason: FailoverReason;
}

export class CooldownRegistry {
    private entries = new Map<string, CooldownEntry>();

    setCooldown(params: { model: string; provider: string; durationMs: number; reason: FailoverReason }): void {
        const key = `${params.provider}:${params.model}`;
        this.entries.set(key, { model: params.model, provider: params.provider, expiresAt: Date.now() + params.durationMs, reason: params.reason });
    }

    isInCooldown(provider: string, model: string): boolean {
        const entry = this.entries.get(`${provider}:${model}`);
        if (!entry) return false;
        if (entry.expiresAt < Date.now()) { this.entries.delete(`${provider}:${model}`); return false; }
        return true;
    }

    getCooldown(provider: string, model: string): CooldownEntry | null {
        const entry = this.entries.get(`${provider}:${model}`);
        if (!entry || entry.expiresAt < Date.now()) return null;
        return entry;
    }

    clearCooldown(provider: string, model: string): boolean {
        return this.entries.delete(`${provider}:${model}`);
    }

    listActive(): CooldownEntry[] {
        const now = Date.now();
        return [...this.entries.values()].filter((e) => e.expiresAt > now);
    }

    pruneExpired(): number {
        const now = Date.now();
        let count = 0;
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt < now) { this.entries.delete(key); count++; }
        }
        return count;
    }
}

/**
 * Should a transient cooldown probe be allowed?
 */
export function shouldAllowCooldownProbe(reason: FailoverReason): boolean {
    return reason === 'rate_limit' || reason === 'server_error';
}
