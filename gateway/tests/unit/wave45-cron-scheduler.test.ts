import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
    parseCronExpression, 
    cronMatchesDate, 
    getNextCronTime, 
    parseNaturalSchedule, 
    CronScheduler 
} from '../../src/cron/scheduler.js';
import type { CronJob } from '../../src/cron/types.js';

describe('Wave 45: Cron Engine I (scheduler.ts)', () => {

    describe('Cron Expression Parser', () => {
        it('parseCronExpression parses standard * * * * *', () => {
            const parsed = parseCronExpression('* * * * *');
            expect(parsed).toHaveLength(5);
            expect(parsed.every(p => p.any)).toBe(true);
        });

        it('parseCronExpression parses specific values', () => {
            const parsed = parseCronExpression('30 9 1 1 1');
            expect(parsed[0].values).toEqual([30]);
            expect(parsed[1].values).toEqual([9]);
            expect(parsed[2].values).toEqual([1]);
            expect(parsed[3].values).toEqual([1]);
            expect(parsed[4].values).toEqual([1]);
        });

        it('parseCronExpression parses lists and ranges', () => {
            const parsed = parseCronExpression('0,15,30,45 9-17 * * *');
            expect(parsed[0].values).toEqual([0, 15, 30, 45]);
            expect(parsed[1].values).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
        });

        it('parseCronExpression parses step values', () => {
            const parsed = parseCronExpression('*/15 */2 * * *');
            expect(parsed[0].values).toEqual([0, 15, 30, 45]);
            expect(parsed[1].values).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]);
        });

        it('parseCronExpression throws on invalid expression', () => {
            expect(() => parseCronExpression('* * *')).toThrow('Invalid cron expression');
        });
    });

    describe('Date Matching & Next Run', () => {
        it('cronMatchesDate correctly identifies matches', () => {
            const fields = parseCronExpression('30 9 * * 1-5'); // 9:30 AM weekdays
            
            // Monday at 9:30 AM
            const matchDate = new Date(2023, 0, 2, 9, 30); // Jan 2, 2023 is Monday
            expect(cronMatchesDate(fields, matchDate)).toBe(true);
            
            // Weekend at 9:30 AM
            const weekendDate = new Date(2023, 0, 1, 9, 30); // Jan 1, 2023 is Sunday
            expect(cronMatchesDate(fields, weekendDate)).toBe(false);
            
            // Monday at 10:30 AM
            const wrongTime = new Date(2023, 0, 2, 10, 30);
            expect(cronMatchesDate(fields, wrongTime)).toBe(false);
        });

        it('getNextCronTime calculates next occurance', () => {
            const fields = parseCronExpression('0 12 * * *'); // Daily at noon
            const baseDate = new Date(2023, 0, 1, 9, 0); // 9:00 AM
            
            const next = getNextCronTime(fields, baseDate);
            expect(next.getHours()).toBe(12);
            expect(next.getMinutes()).toBe(0);
            expect(next.getDate()).toBe(1); // Same day
        });

        it('getNextCronTime rolls over to next day', () => {
            const fields = parseCronExpression('0 9 * * *'); // Daily at 9:00 AM
            const baseDate = new Date(2023, 0, 1, 12, 0); // Noon
            
            const next = getNextCronTime(fields, baseDate);
            expect(next.getHours()).toBe(9);
            expect(next.getDate()).toBe(2); // Next day
        });
    });

    describe('Natural Language Parsing', () => {
        it('parses "every N minutes"', () => {
            expect(parseNaturalSchedule('every 5 minutes')).toBe('*/5 * * * *');
            expect(parseNaturalSchedule('every 15 minute')).toBe('*/15 * * * *');
        });

        it('parses "every hour/minute"', () => {
            expect(parseNaturalSchedule('every hour')).toBe('0 * * * *');
            expect(parseNaturalSchedule('every minute')).toBe('* * * * *');
            expect(parseNaturalSchedule('every 2 hours')).toBe('0 */2 * * *');
        });

        it('parses "day at specific time"', () => {
            expect(parseNaturalSchedule('every day at 9:30 am')).toBe('30 9 * * *');
            expect(parseNaturalSchedule('every day at 2:15 pm')).toBe('15 14 * * *');
            expect(parseNaturalSchedule('every day at 12:00 am')).toBe('0 0 * * *');
            expect(parseNaturalSchedule('every day at 12:00 pm')).toBe('0 12 * * *');
        });

        it('parses morning/evening shortcuts', () => {
            expect(parseNaturalSchedule('every morning')).toBe('0 8 * * *'); // default 8am
            expect(parseNaturalSchedule('every morning at 7')).toBe('0 7 * * *');
            expect(parseNaturalSchedule('every evening')).toBe('0 18 * * *'); // default 6pm
            expect(parseNaturalSchedule('every evening at 20')).toBe('0 20 * * *');
        });

        it('parses days of week', () => {
            expect(parseNaturalSchedule('every monday')).toBe('0 9 * * 1');
            expect(parseNaturalSchedule('every friday')).toBe('0 9 * * 5');
            expect(parseNaturalSchedule('every weekday')).toBe('0 9 * * 1-5');
            expect(parseNaturalSchedule('every weekend')).toBe('0 10 * * 0,6');
        });

        it('passes through valid cron expressions', () => {
            expect(parseNaturalSchedule('*/10 * * * *')).toBe('*/10 * * * *');
        });

        it('throws on unparseable natural language', () => {
            expect(() => parseNaturalSchedule('do this once a year')).toThrow();
        });
    });

    describe('CronScheduler Lifecycle', () => {
        let scheduler: CronScheduler;

        beforeEach(() => {
            vi.useFakeTimers();
            // Start at a known time: 2023-01-01 12:00:00 (Sunday)
            vi.setSystemTime(new Date(2023, 0, 1, 12, 0, 0));
            scheduler = new CronScheduler({ enabled: true });
        });

        afterEach(() => {
            scheduler.destroy();
            vi.useRealTimers();
            vi.restoreAllMocks();
        });

        it('createJob adds job to internal store and schedules it', () => {
            const job = scheduler.createJob({
                name: 'Test Job',
                schedule: 'every 15 minutes',
                action: 'custom',
                payload: 'test'
            });

            expect(job.id).toBeDefined();
            expect(job.name).toBe('Test Job');
            expect(job.schedule.type).toBe('natural');
            expect(job.schedule.expression).toBe('*/15 * * * *');
            expect(job.status).toBe('active');
            
            expect(scheduler.getJob(job.id)).toBe(job);
            expect(scheduler.listJobs()).toHaveLength(1);
        });

        it('pauseJob and resumeJob change status and manage timers', () => {
            const job = scheduler.createJob({
                name: 'Test', schedule: '* * * * *', action: 'custom', payload: ''
            });

            expect(scheduler.getStats().activeJobs).toBe(1);
            expect(scheduler.getStats().pausedJobs).toBe(0);

            const paused = scheduler.pauseJob(job.id);
            expect(paused).toBe(true);
            expect(job.status).toBe('paused');
            expect(scheduler.getStats().activeJobs).toBe(0);
            expect(scheduler.getStats().pausedJobs).toBe(1);

            const resumed = scheduler.resumeJob(job.id);
            expect(resumed).toBe(true);
            expect(job.status).toBe('active');
        });

        it('deleteJob removes job entirely', () => {
            const job = scheduler.createJob({
                name: 'Test', schedule: '* * * * *', action: 'custom', payload: ''
            });
            
            expect(scheduler.deleteJob(job.id)).toBe(true);
            expect(scheduler.listJobs()).toHaveLength(0);
            expect(scheduler.getStats().totalJobs).toBe(0);
        });

        it('job execution triggers onExecute handler and records history', async () => {
            const executor = vi.fn().mockResolvedValue({
                success: true, output: 'Done', durationMs: 10
            } as any);
            scheduler.setExecutor(executor);

            const job = scheduler.createJob({
                name: 'QuickRun', schedule: '* * * * *', action: 'custom', payload: '123'
            });

            // Advance time by 1 minute
            await vi.advanceTimersByTimeAsync(60_000);

            expect(executor).toHaveBeenCalledTimes(1);
            expect(executor.mock.calls[0][0].id).toBe(job.id);
            
            expect(job.runCount).toBe(1);
            expect(job.failCount).toBe(0);
            
            const history = scheduler.getHistory(job.id);
            expect(history).toHaveLength(1);
            expect(history[0].success).toBe(true);
        });

        it('job failure increments failCount', async () => {
            const executor = vi.fn().mockRejectedValue(new Error('Crash'));
            scheduler.setExecutor(executor);

            const job = scheduler.createJob({
                name: 'FailRun', schedule: '* * * * *', action: 'custom', payload: ''
            });

            await vi.advanceTimersByTimeAsync(60_000);

            expect(job.runCount).toBe(1);
            expect(job.failCount).toBe(1);
            
            const history = scheduler.getHistory(job.id);
            expect(history[0].success).toBe(false);
            expect(history[0].error).toContain('Crash');
        });

        it('fireNow triggers manual execution immediately', async () => {
            const executor = vi.fn().mockResolvedValue({ success: true, durationMs: 5 } as any);
            scheduler.setExecutor(executor);

            const job = scheduler.createJob({
                name: 'Manual', schedule: '0 0 1 1 *', action: 'custom', payload: ''
            }); // Far future

            await scheduler.fireNow(job.id);

            expect(executor).toHaveBeenCalledTimes(1);
            expect(job.runCount).toBe(1);
            
            const history = scheduler.getHistory(job.id);
            expect(history).toHaveLength(1);
        });

        it('maxRuns auto-completes job after N runs', async () => {
            const executor = vi.fn().mockResolvedValue({ success: true } as any);
            scheduler.setExecutor(executor);

            const job = scheduler.createJob({
                name: 'MaxRuns', schedule: '* * * * *', action: 'custom', payload: '', maxRuns: 2
            });

            await vi.advanceTimersByTimeAsync(60_000); // Run 1
            expect(job.status).toBe('active');
            
            await vi.advanceTimersByTimeAsync(60_000); // Run 2
            // Should now trigger the completed state logic in scheduleNext
            await vi.advanceTimersByTimeAsync(60_000); // Attempt Run 3
            
            expect(job.runCount).toBe(2); // didn't run 3rd time
            expect(job.status).toBe('completed');
        });

        it('dependencies delay execution if unmet', async () => {
            const executor = vi.fn().mockResolvedValue({ success: true } as any);
            scheduler.setExecutor(executor);

            const depJob = scheduler.createJob({
                name: 'Parent', schedule: '0 0 1 1 *', action: 'custom', payload: '' // active but not running
            });

            const job = scheduler.createJob({
                name: 'Child', schedule: '* * * * *', action: 'custom', payload: '', dependsOn: depJob.id
            });

            await vi.advanceTimersByTimeAsync(60_000);
            
            // Should not have run because depJob is not completed
            expect(job.runCount).toBe(0);
            expect(executor).not.toHaveBeenCalled();
            
            // Complete parent manually
            depJob.status = 'completed';
            
            await vi.advanceTimersByTimeAsync(60_000);
            // Now it should run
            expect(job.runCount).toBe(1);
        });
    });
});
