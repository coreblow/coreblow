import { describe, it, expect } from 'vitest';
import { SessionRateLimit } from './rate-limit.js';

describe('SessionRateLimit', () => {
    it('should allow within limit', () => {
        const rl = new SessionRateLimit();
        expect(rl.check('s1', 3, 60000)).toBe(true);
        expect(rl.check('s1', 3, 60000)).toBe(true);
        expect(rl.check('s1', 3, 60000)).toBe(true);
    });

    it('should block over limit', () => {
        const rl = new SessionRateLimit();
        rl.check('s1', 2, 60000);
        rl.check('s1', 2, 60000);
        expect(rl.check('s1', 2, 60000)).toBe(false);
    });

    it('should track independently per session', () => {
        const rl = new SessionRateLimit();
        rl.check('s1', 1, 60000);
        expect(rl.check('s1', 1, 60000)).toBe(false);
        expect(rl.check('s2', 1, 60000)).toBe(true);
    });
});
