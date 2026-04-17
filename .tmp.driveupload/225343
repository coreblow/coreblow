/**
 * cron/next-run.test.ts — Next run calculation tests
 */
import { describe, it, expect } from 'vitest';
import { shouldRun } from './next-run.js';

describe('shouldRun', () => {
    it('should return true when interval elapsed', () => {
        expect(shouldRun(Date.now() - 10000, 5000)).toBe(true);
    });

    it('should return false within interval', () => {
        expect(shouldRun(Date.now() - 1000, 5000)).toBe(false);
    });
});
