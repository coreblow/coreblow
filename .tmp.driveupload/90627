/**
 * CoreBlow — Rate Limiter
 *
 * Token bucket implementation for API rate limiting
 * and resource throttling.
 */

export interface RateLimitConfig {
    maxTokens: number;
    refillRate: number; // Tokens added per second
    refillIntervalMs?: number; // Refill check interval (how often tokens are added)
}

interface Bucket {
    tokens: number;
    lastRefilled: number;
    config: RateLimitConfig;
}

/**
 * CoreBlow Rate Limiter
 */
export class RateLimiter {
    private buckets = new Map<string, Bucket>();

    /**
     * Get or create a bucket.
     */
    private getBucket(key: string, config: RateLimitConfig): Bucket {
        if (!this.buckets.has(key)) {
            this.buckets.set(key, {
                tokens: config.maxTokens,
                lastRefilled: Date.now(),
                config,
            });
        }
        const bucket = this.buckets.get(key)!;
        this.refill(bucket);
        return bucket;
    }

    /**
     * Refill bucket based on time passed.
     */
    private refill(bucket: Bucket): void {
        const now = Date.now();
        const deltaMs = now - bucket.lastRefilled;

        // Tokens per ms
        const tokensToPromote = deltaMs * (bucket.config.refillRate / 1000);

        if (tokensToPromote > 0) {
            bucket.tokens = Math.min(bucket.config.maxTokens, bucket.tokens + tokensToPromote);
            bucket.lastRefilled = now;
        }
    }

    /**
     * Check if request is allowed, optionally consuming tokens.
     */
    allow(key: string, config: RateLimitConfig, tokens: number = 1): boolean {
        const bucket = this.getBucket(key, config);
        if (bucket.tokens >= tokens) {
            bucket.tokens -= tokens;
            return true;
        }
        return false;
    }

    /**
     * Check cost but do not consume tokens.
     */
    inspect(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number } {
        const bucket = this.getBucket(key, config);
        return {
            allowed: bucket.tokens >= 1,
            remaining: Math.floor(bucket.tokens),
        };
    }

    /**
     * Reset bucket explicitly.
     */
    reset(key: string): boolean {
        return this.buckets.delete(key);
    }

    /**
     * Clear all buckets.
     */
    clear(): void {
        this.buckets.clear();
    }
}
