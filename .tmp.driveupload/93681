/**
 * CoreBlow Cron Engine — Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CronEngine } from '../../src/cron/engine.js';
import type { CronJob } from '../../src/cron/engine.js';

function createJob(overrides: Partial<CronJob> = {}): CronJob {
    return {
        id: overrides.id ?? 'test-job',
        name: overrides.name ?? 'Test Job',
        schedule: overrides.schedule ?? { kind: 'every', intervalMs: 60_000 },
        handler: overrides.handler ?? (async () => 'done'),
        enabled: overrides.enabled ?? true,
        ...overrides,
    };
}

describe('CronEngine', () => {
    let engine: CronEngine;

    beforeEach(() => {
        engine = new CronEngine();
    });

    afterEach(() => {
        engine.stop();
    });

    it('should add a job', () => {
        engine.addJob(createJob());
        expect(engine.listJobs()).toHaveLength(1);
    });

    it('should reject duplicate job IDs', () => {
        engine.addJob(createJob({ id: 'dup' }));
        expect(() => engine.addJob(createJob({ id: 'dup' }))).toThrow('already exists');
    });

    it('should remove a job', () => {
        engine.addJob(createJob({ id: 'removable' }));
        expect(engine.removeJob('removable')).toBe(true);
        expect(engine.listJobs()).toHaveLength(0);
    });

    it('should enable/disable jobs', () => {
        engine.addJob(createJob({ id: 'toggleable' }));
        expect(engine.setJobEnabled('toggleable', false)).toBe(true);

        const jobs = engine.listJobs();
        expect(jobs[0]!.enabled).toBe(false);
    });

    it('should run a job immediately', async () => {
        let ran = false;
        engine.addJob(createJob({
            handler: async () => { ran = true; return 'complete'; },
        }));

        const result = await engine.runNow('test-job');
        expect(ran).toBe(true);
        expect(result.status).toBe('ok');
        expect(result.output).toBe('complete');
        expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle job errors', async () => {
        engine.addJob(createJob({
            handler: async () => { throw new Error('job failed'); },
        }));

        const result = await engine.runNow('test-job');
        expect(result.status).toBe('error');
        expect(result.error).toBe('job failed');
    });

    it('should track job history', async () => {
        engine.addJob(createJob());
        await engine.runNow('test-job');
        await engine.runNow('test-job');

        const history = engine.getHistory('test-job');
        expect(history).toHaveLength(2);
    });

    it('should handle job timeout', async () => {
        engine.addJob(createJob({
            id: 'slow-job',
            timeout: 50, // 50ms timeout
            handler: async (ctx) => {
                // Simulate slow work that checks abort signal
                await new Promise((resolve, reject) => {
                    const timer = setTimeout(resolve, 5000);
                    ctx.signal.addEventListener('abort', () => {
                        clearTimeout(timer);
                        reject(new Error('aborted'));
                    });
                });
            },
        }));

        const result = await engine.runNow('slow-job');
        expect(result.status).toBe('timeout');
    });

    it('should retry failed jobs', async () => {
        let attempts = 0;
        engine.addJob(createJob({
            id: 'retry-job',
            retries: 2,
            handler: async () => {
                attempts++;
                if (attempts < 3) throw new Error('not yet');
                return 'success';
            },
        }));

        const result = await engine.runNow('retry-job');
        expect(attempts).toBe(3);
        expect(result.status).toBe('ok');
    });

    it('should skip concurrent runs of same job', async () => {
        let running = 0;
        let maxConcurrent = 0;

        engine.addJob(createJob({
            id: 'concurrent-job',
            handler: async () => {
                running++;
                maxConcurrent = Math.max(maxConcurrent, running);
                await new Promise((r) => setTimeout(r, 50));
                running--;
            },
        }));

        // Run two in parallel
        const [r1, r2] = await Promise.all([
            engine.runNow('concurrent-job'),
            engine.runNow('concurrent-job'),
        ]);

        // Second should be skipped
        expect(r2.status).toBe('skipped');
    });

    it('should list jobs with running state', () => {
        engine.addJob(createJob());
        const jobs = engine.listJobs();
        expect(jobs[0]!.isRunning).toBe(false);
    });

    it('should return false for nonexistent job operations', () => {
        expect(engine.removeJob('nope')).toBe(false);
        expect(engine.setJobEnabled('nope', true)).toBe(false);
    });

    it('should throw for runNow on nonexistent job', async () => {
        await expect(engine.runNow('nope')).rejects.toThrow('not found');
    });
});
