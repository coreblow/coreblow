import { describe, it, expect } from 'vitest';
import { ConcurrencyLimiter } from './concurrency.js';

describe('ConcurrencyLimiter', () => {
    it('should allow up to max concurrent', async () => {
        const limiter = new ConcurrencyLimiter(2);
        await limiter.acquire();
        await limiter.acquire();
        expect(limiter.getActive()).toBe(2);
        limiter.release();
        expect(limiter.getActive()).toBe(1);
        limiter.release();
        expect(limiter.getActive()).toBe(0);
    });

    it('should queue beyond max', async () => {
        const limiter = new ConcurrencyLimiter(1);
        await limiter.acquire();
        expect(limiter.getActive()).toBe(1);
        const p = limiter.acquire();
        expect(limiter.getQueued()).toBe(1);
        limiter.release();
        await p;
        expect(limiter.getActive()).toBe(1);
        expect(limiter.getQueued()).toBe(0);
        limiter.release();
    });
});
