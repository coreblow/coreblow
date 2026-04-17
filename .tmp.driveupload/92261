/**
 * CoreBlow — Token Bucket Rate Limiter
 *
 * Token bucket algorithm for fine-grained rate limiting.
 * Supports per-key buckets, burst capacity, refill rates,
 * and usage statistics.
 */

/** Bucket state */
export interface Bucket {
    key: string;
    tokens: number;
    maxTokens: number;
    refillRate: number; // tokens per second
    lastRefill: number;
    totalConsumed: number;
    totalRejected: number;
}

/**
 * CoreBlow Token Bucket
 */
export class TokenBucket {
    private buckets = new Map<string, Bucket>();
    private defaultMax: number;
    private defaultRefillRate: number;

    constructor(maxTokens: number = 100, refillRate: number = 10) {
        this.defaultMax = maxTokens;
        this.defaultRefillRate = refillRate;
    }

    /**
     * Try to consume tokens. Returns true if allowed.
     */
    consume(key: string, tokens: number = 1): boolean {
        const bucket = this.getOrCreate(key);
        this.refill(bucket);

        if (bucket.tokens >= tokens) {
            bucket.tokens -= tokens;
            bucket.totalConsumed += tokens;
            return true;
        }

        bucket.totalRejected += tokens;
        return false;
    }

    /**
     * Check if tokens are available (without consuming).
     */
    check(key: string, tokens: number = 1): boolean {
        const bucket = this.getOrCreate(key);
        this.refill(bucket);
        return bucket.tokens >= tokens;
    }

    /**
     * Get remaining tokens.
     */
    remaining(key: string): number {
        const bucket = this.getOrCreate(key);
        this.refill(bucket);
        return Math.floor(bucket.tokens);
    }

    /**
     * Get time until N tokens available (ms).
     */
    waitTime(key: string, tokens: number = 1): number {
        const bucket = this.getOrCreate(key);
        this.refill(bucket);
        if (bucket.tokens >= tokens) return 0;
        const needed = tokens - bucket.tokens;
        return Math.ceil((needed / bucket.refillRate) * 1000);
    }

    /**
     * Reset a bucket.
     */
    reset(key: string): boolean {
        const bucket = this.buckets.get(key);
        if (!bucket) return false;
        bucket.tokens = bucket.maxTokens;
        bucket.lastRefill = Date.now();
        return true;
    }

    /**
     * Configure a specific key bucket.
     */
    configure(key: string, maxTokens: number, refillRate: number): void {
        const existing = this.buckets.get(key);
        if (existing) {
            existing.maxTokens = maxTokens;
            existing.refillRate = refillRate;
        } else {
            this.buckets.set(key, {
                key, tokens: maxTokens, maxTokens, refillRate,
                lastRefill: Date.now(), totalConsumed: 0, totalRejected: 0,
            });
        }
    }

    /**
     * Get bucket stats.
     */
    getStats(key: string): { tokens: number; max: number; consumed: number; rejected: number } | null {
        const bucket = this.buckets.get(key);
        if (!bucket) return null;
        this.refill(bucket);
        return { tokens: Math.floor(bucket.tokens), max: bucket.maxTokens, consumed: bucket.totalConsumed, rejected: bucket.totalRejected };
    }

    /**
     * Remove a bucket.
     */
    remove(key: string): boolean {
        return this.buckets.delete(key);
    }

    /** Count */
    count(): number { return this.buckets.size; }

    // === Private ===

    private getOrCreate(key: string): Bucket {
        let bucket = this.buckets.get(key);
        if (!bucket) {
            bucket = {
                key, tokens: this.defaultMax, maxTokens: this.defaultMax,
                refillRate: this.defaultRefillRate, lastRefill: Date.now(),
                totalConsumed: 0, totalRejected: 0,
            };
            this.buckets.set(key, bucket);
        }
        return bucket;
    }

    private refill(bucket: Bucket): void {
        const now = Date.now();
        const elapsed = (now - bucket.lastRefill) / 1000;
        bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
        bucket.lastRefill = now;
    }
}
