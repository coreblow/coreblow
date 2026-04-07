/**
 * cron/cron-lock.test.ts — Cron lock tests
 */
import { describe, it, expect } from 'vitest';
import { CronLock } from './cron-lock.js';

describe('CronLock', () => {
    it('should acquire and release lock', () => {
        const lock = new CronLock();
        expect(lock.acquire('job1')).toBe(true);
        expect(lock.acquire('job1')).toBe(false);
        lock.release('job1');
        expect(lock.acquire('job1')).toBe(true);
    });

    it('should allow different jobs concurrently', () => {
        const lock = new CronLock();
        expect(lock.acquire('job1')).toBe(true);
        expect(lock.acquire('job2')).toBe(true);
    });
});
