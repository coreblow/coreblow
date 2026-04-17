/**
 * tests/security/rate-limiter.test.ts
 * Tests for token bucket rate limiting.
 */
import { describe, it, expect } from 'vitest';
import { TokenBucket } from '../../src/security/token-bucket.js';

describe('TokenBucket', () => {
    it('should allow requests within limit', () => {
        const bucket = new TokenBucket(10, 10);
        expect(bucket.consume('user1')).toBe(true);
    });

    it('should reject when empty', () => {
        const bucket = new TokenBucket(2, 0);
        expect(bucket.consume('k')).toBe(true);
        expect(bucket.consume('k')).toBe(true);
        expect(bucket.consume('k')).toBe(false);
    });

    it('should consume multiple tokens', () => {
        const bucket = new TokenBucket(5, 0);
        expect(bucket.consume('k', 3)).toBe(true);
        expect(bucket.consume('k', 3)).toBe(false);
    });

    it('should report remaining tokens', () => {
        const bucket = new TokenBucket(10, 0);
        expect(bucket.remaining('k')).toBe(10);
        bucket.consume('k', 3);
        expect(bucket.remaining('k')).toBe(7);
    });

    it('should check without consuming', () => {
        const bucket = new TokenBucket(5, 0);
        expect(bucket.check('k', 3)).toBe(true);
        expect(bucket.remaining('k')).toBe(5); // not consumed
    });

    it('should refill over time', async () => {
        const bucket = new TokenBucket(5, 100);
        bucket.consume('k', 5); // drain
        expect(bucket.remaining('k')).toBe(0);
        await new Promise(r => setTimeout(r, 60));
        expect(bucket.remaining('k')).toBeGreaterThan(0);
    });

    it('should not exceed capacity', async () => {
        const bucket = new TokenBucket(5, 1000);
        await new Promise(r => setTimeout(r, 50));
        expect(bucket.remaining('k')).toBeLessThanOrEqual(5);
    });

    it('should support reset', () => {
        const bucket = new TokenBucket(10, 0);
        bucket.consume('k', 10);
        expect(bucket.remaining('k')).toBe(0);
        bucket.reset('k');
        expect(bucket.remaining('k')).toBe(10);
    });

    it('should handle burst', () => {
        const bucket = new TokenBucket(100, 0);
        let consumed = 0;
        while (bucket.consume('k')) consumed++;
        expect(consumed).toBe(100);
    });

    it('should report stats', () => {
        const bucket = new TokenBucket(10, 1);
        bucket.consume('k', 3);
        bucket.consume('k', 2);
        const stats = bucket.getStats('k');
        expect(stats!.consumed).toBe(5);
        expect(stats!.max).toBe(10);
    });

    it('should return null stats for unknown key', () => {
        const bucket = new TokenBucket();
        expect(bucket.getStats('unknown')).toBeNull();
    });

    it('should separate keys', () => {
        const bucket = new TokenBucket(3, 0);
        bucket.consume('a', 3);
        expect(bucket.consume('a')).toBe(false);
        expect(bucket.consume('b')).toBe(true); // different key
    });

    it('should configure per-key limits', () => {
        const bucket = new TokenBucket(10, 1);
        bucket.configure('premium', 1000, 100);
        expect(bucket.remaining('premium')).toBe(1000);
    });

    it('should remove buckets', () => {
        const bucket = new TokenBucket();
        bucket.consume('k');
        expect(bucket.count()).toBe(1);
        bucket.remove('k');
        expect(bucket.count()).toBe(0);
    });

    it('should calculate wait time', () => {
        const bucket = new TokenBucket(5, 10);
        bucket.consume('k', 5);
        const wait = bucket.waitTime('k', 1);
        expect(wait).toBeGreaterThan(0);
    });
});
