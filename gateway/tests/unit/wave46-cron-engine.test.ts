import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CronEngine } from '../../src/cron/engine.js';
import { CronLock } from '../../src/cron/cron-lock.js';
import { CronHistory } from '../../src/cron/history.js';
import type { CronJob, CronJobContext } from '../../src/cron/engine.js';

describe('Wave 46: Cron Engine II', () => {

    describe('CronLock (cron-lock.ts)', () => {
        it('acquire returns true if unlocked and false if locked', () => {
            const lock = new CronLock();
            expect(lock.acquire('job-1')).toBe(true);
            expect(lock.acquire('job-1')).toBe(false); // Already locked
            expect(lock.acquire('job-2')).toBe(true); // Different lock
        });

        it('release unlocks the lock', () => {
            const lock = new CronLock();
            expect(lock.acquire('job-1')).toBe(true);
            lock.release('job-1');
            expect(lock.acquire('job-1')).toBe(true); // Can lock again
        });
    });

    describe('CronHistory (history.ts)', () => {
        it('records and returns history by job id', () => {
            const history = new CronHistory();
            history.record('job-1', 100, true);
            history.record('job-2', 50, false, 'Failed badly');
            history.record('job-1', 120, true);

            const job1History = history.getByJob('job-1');
            expect(job1History).toHaveLength(2);
            expect(job1History[0].success).toBe(true);
            expect(job1History[0].durationMs).toBe(100);
            
            const job2History = history.getByJob('job-2');
            expect(job2History).toHaveLength(1);
        });

        it('gets all failures', () => {
            const history = new CronHistory();
            history.record('job-1', 10, true);
            history.record('job-2', 20, false, 'Network error');
            history.record('job-3', 30, false, 'Timeout error');

            const failures = history.getFailures();
            expect(failures).toHaveLength(2);
            expect(failures[0].error).toBe('Network error');
            expect(failures[1].error).toBe('Timeout error');
        });

        it('caps at 1000 history entries', () => {
            const history = new CronHistory();
            for (let i = 0; i < 1050; i++) {
                history.record('job-1', 10, true);
            }
            // Should contain exactly 1000
            expect(history.getByJob('job-1')).toHaveLength(1000);
        });
    });

    describe('CronEngine (engine.ts)', () => {
        let engine: CronEngine;

        beforeEach(() => {
            vi.useFakeTimers();
            // Anchor to Jan 1 2023, midnight
            vi.setSystemTime(new Date(2023, 0, 1, 0, 0, 0));
            engine = new CronEngine();
        });

        afterEach(() => {
            engine.stop();
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        const mockHandler = vi.fn().mockResolvedValue('Done');

        function makeJob(id: string, schedule: any, enabled = true): CronJob {
            return {
                id,
                name: `Test ${id}`,
                schedule,
                handler: mockHandler,
                enabled,
            };
        }

        it('addJob fails on duplicate IDs', () => {
            engine.addJob(makeJob('job-1', { kind: 'every', intervalMs: 1000 }));
            expect(() => engine.addJob(makeJob('job-1', { kind: 'every', intervalMs: 2000 }))).toThrow('already exists');
        });

        it('removeJob deletes the job', () => {
            engine.addJob(makeJob('job-1', { kind: 'every', intervalMs: 1000 }));
            expect(engine.listJobs()).toHaveLength(1);
            
            expect(engine.removeJob('job-1')).toBe(true);
            expect(engine.listJobs()).toHaveLength(0);
        });

        it('setJobEnabled turns jobs on and off', () => {
            const job = makeJob('job-1', { kind: 'every', intervalMs: 1000 }, false);
            engine.addJob(job);
            expect(engine.listJobs()[0].enabled).toBe(false);

            engine.setJobEnabled('job-1', true);
            expect(engine.listJobs()[0].enabled).toBe(true);
        });

        it('start() initializes enabled jobs and stop() clears timers', () => {
            engine.addJob(makeJob('job-1', { kind: 'every', intervalMs: 1000 }));
            engine.start(); // This should trigger scheduleNext

            // Since it's every 1000ms, let's advance time
            vi.advanceTimersByTime(1100);
            expect(mockHandler).toHaveBeenCalledTimes(1);

            engine.stop();
            vi.advanceTimersByTime(1100);
            // Shouldn't increase
            expect(mockHandler).toHaveBeenCalledTimes(1);
        });

        it('handles "at" schedules exactly once', async () => {
            engine.start();
            // Sched in 5 seconds
            const fireDate = new Date(Date.now() + 5000);
            engine.addJob(makeJob('job-1', { kind: 'at', at: fireDate }));

            await vi.advanceTimersByTimeAsync(4000);
            expect(mockHandler).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(1100);
            expect(mockHandler).toHaveBeenCalledTimes(1);

            // Time passes, shouldn't run again for "at"
            await vi.advanceTimersByTimeAsync(10000);
            expect(mockHandler).toHaveBeenCalledTimes(1);
        });

        it('handles "every" schedules repeatedly', async () => {
            engine.start();
            engine.addJob(makeJob('job-1', { kind: 'every', intervalMs: 2000 }));

            await vi.advanceTimersByTimeAsync(2100);
            expect(mockHandler).toHaveBeenCalledTimes(1);

            await vi.advanceTimersByTimeAsync(2000);
            expect(mockHandler).toHaveBeenCalledTimes(2);
        });

        it('handles "cron" schedules with parsing', async () => {
            engine.start();
            // Run at top of every minute
            engine.addJob(makeJob('job-1', { kind: 'cron', expr: '* * * * *' }));

            // Initial time is 0:00:00 (midnight exact). Next minute is 0:01:00
            await vi.advanceTimersByTimeAsync(59_000);
            expect(mockHandler).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(2000);
            expect(mockHandler).toHaveBeenCalledTimes(1);
            
            await vi.advanceTimersByTimeAsync(60_000);
            expect(mockHandler).toHaveBeenCalledTimes(2);
        });

        it('runNow executes immediately regardless of schedule', async () => {
            engine.addJob(makeJob('job-1', { kind: 'every', intervalMs: 100_000 }));
            
            const run = await engine.runNow('job-1');
            expect(mockHandler).toHaveBeenCalledTimes(1);
            expect(run.status).toBe('ok');
        });

        it('records history accurately', async () => {
            mockHandler.mockResolvedValueOnce('Result').mockRejectedValueOnce(new Error('Testing DB Failure'));
            engine.start();
            
            engine.addJob(makeJob('job-1', { kind: 'every', intervalMs: 1000 }));
            
            await vi.advanceTimersByTimeAsync(1100); // 1st run
            await vi.advanceTimersByTimeAsync(1000); // 2nd run
            
            // Advance small amount to resolve microtasks
            await vi.advanceTimersByTimeAsync(10);
            
            const history = engine.getHistory('job-1');
            expect(history).toHaveLength(2);
            expect(history[0].status).toBe('ok');
            expect(history[0].output).toBe('Result');
            
            expect(history[1].status).toBe('error');
            expect(history[1].error).toContain('Testing DB Failure');
        });

        it('cancels job if aborted via timeout', async () => {
            const timeoutHandler = vi.fn().mockImplementation(async (ctx: CronJobContext) => {
                return new Promise((resolve, reject) => {
                    const timer = setTimeout(resolve, 5000);
                    ctx.signal.addEventListener('abort', () => {
                        clearTimeout(timer);
                        reject(new Error('Aborted by signal'));
                    });
                });
            });

            engine.start();
            const job = makeJob('job-1', { kind: 'every', intervalMs: 1000 });
            job.handler = timeoutHandler;
            job.timeout = 2000; // Timeout after 2s
            engine.addJob(job);

            // Trigger run
            const promise = vi.advanceTimersByTimeAsync(3500); 
            // the job starts at +1000ms, times out at +3000ms
            
            await promise;
            
            const history = engine.getHistory('job-1');
            expect(history.length).toBeGreaterThan(0);
            // The logic correctly marks it as timeout
            expect(history[0].status).toBe('timeout');
        });

        it('reports current listJobs state correctly', () => {
            engine.addJob(makeJob('job-1', { kind: 'every', intervalMs: 1000 }));
            
            const list = engine.listJobs();
            expect(list).toHaveLength(1);
            expect(list[0].id).toBe('job-1');
            expect(list[0].nextRun).toBeDefined();
            expect(list[0].isRunning).toBe(false);
        });

        it('handles retries transparently on error', async () => {
            let attempt = 0;
            const failingHandler = vi.fn().mockImplementation(() => {
                attempt++;
                if (attempt < 3) throw new Error('Fail');
                return 'Success on 3';
            });

            engine.start();
            const job = makeJob('job-1', { kind: 'every', intervalMs: 1000 });
            job.handler = failingHandler;
            job.retries = 2; // 1 normal + 2 retries = 3 allowed
            engine.addJob(job);

            await vi.advanceTimersByTimeAsync(1100);
            
            // Advance small amount to resolve microtasks
            await vi.advanceTimersByTimeAsync(10);
            
            const history = engine.getHistory('job-1');
            expect(history).toHaveLength(1);
            expect(history[0].status).toBe('ok');
            expect(history[0].output).toBe('Success on 3');
            expect(failingHandler).toHaveBeenCalledTimes(3);
        });
    });
});
