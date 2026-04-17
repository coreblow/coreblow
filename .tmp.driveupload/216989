/**
 * Discord Rate Limiter — Per-channel/user rate limiting for API calls.
 */
export class DiscordRateLimiter {
    private buckets = new Map<string, { tokens: number; lastRefill: number }>();
    private maxTokens: number;
    private refillRateMs: number;

    constructor(maxTokens: number = 5, refillRateMs: number = 5000) { this.maxTokens = maxTokens; this.refillRateMs = refillRateMs; }

    consume(key: string): { allowed: boolean; retryAfterMs: number } {
        const now = Date.now();
        let bucket = this.buckets.get(key);
        if (!bucket) { bucket = { tokens: this.maxTokens, lastRefill: now }; this.buckets.set(key, bucket); }

        const elapsed = now - bucket.lastRefill;
        const refills = Math.floor(elapsed / this.refillRateMs);
        if (refills > 0) { bucket.tokens = Math.min(this.maxTokens, bucket.tokens + refills); bucket.lastRefill = now; }

        if (bucket.tokens > 0) { bucket.tokens--; return { allowed: true, retryAfterMs: 0 }; }
        return { allowed: false, retryAfterMs: this.refillRateMs - (elapsed % this.refillRateMs) };
    }

    reset(key: string): void { this.buckets.delete(key); }
}
