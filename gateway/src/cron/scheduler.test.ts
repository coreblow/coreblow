// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CronScheduler, parseCronExpression, cronMatchesDate, getNextCronTime, parseNaturalSchedule } from './scheduler.js';

describe('Cron Scheduler — Phase 10', () => {

    // ─── Cron Expression Parser ────────────────────────────────

    describe('parseCronExpression', () => {
        it('parses wildcard expression', () => {
            const fields = parseCronExpression('* * * * *');
            expect(fields).toHaveLength(5);
            expect(fields[0].any).toBe(true);
        });

        it('parses specific values', () => {
            const fields = parseCronExpression('30 9 * * *');
            expect(fields[0].values).toEqual([30]);
            expect(fields[1].values).toEqual([9]);
        });

        it('parses ranges', () => {
            const fields = parseCronExpression('0 9-17 * * *');
            expect(fields[1].values).toEqual([9,10,11,12,13,14,15,16,17]);
        });

        it('parses steps', () => {
            const fields = parseCronExpression('*/15 * * * *');
            expect(fields[0].values).toEqual([0,15,30,45]);
        });

        it('parses comma-separated', () => {
            const fields = parseCronExpression('0 9,12,18 * * *');
            expect(fields[1].values).toEqual([9,12,18]);
        });

        it('rejects invalid expression', () => {
            expect(() => parseCronExpression('* * *')).toThrow('expected 5 fields');
        });
    });

    describe('cronMatchesDate', () => {
        it('matches every-minute pattern', () => {
            const fields = parseCronExpression('* * * * *');
            expect(cronMatchesDate(fields, new Date())).toBe(true);
        });

        it('matches specific time', () => {
            const fields = parseCronExpression('30 14 * * *');
            const d = new Date(2026, 0, 15, 14, 30);
            expect(cronMatchesDate(fields, d)).toBe(true);
            expect(cronMatchesDate(fields, new Date(2026, 0, 15, 14, 31))).toBe(false);
        });

        it('matches day of week', () => {
            const fields = parseCronExpression('0 9 * * 1'); // Monday
            const monday = new Date(2026, 3, 6, 9, 0); // April 6 2026 is Monday
            expect(cronMatchesDate(fields, monday)).toBe(true);
        });
    });

    describe('getNextCronTime', () => {
        it('finds next run for every-minute', () => {
            const fields = parseCronExpression('* * * * *');
            const next = getNextCronTime(fields);
            expect(next.getTime()).toBeGreaterThan(Date.now());
        });

        it('finds next run for specific hour', () => {
            const fields = parseCronExpression('0 3 * * *'); // 3am daily
            const next = getNextCronTime(fields);
            expect(next.getHours()).toBe(3);
            expect(next.getMinutes()).toBe(0);
        });
    });

    // ─── Natural Language Parsing ──────────────────────────────

    describe('parseNaturalSchedule', () => {
        it('parses "every 5 minutes"', () => {
            expect(parseNaturalSchedule('every 5 minutes')).toBe('*/5 * * * *');
        });

        it('parses "every 2 hours"', () => {
            expect(parseNaturalSchedule('every 2 hours')).toBe('0 */2 * * *');
        });

        it('parses "every hour"', () => {
            expect(parseNaturalSchedule('every hour')).toBe('0 * * * *');
        });

        it('parses "every day at 9:30"', () => {
            expect(parseNaturalSchedule('every day at 9:30')).toBe('30 9 * * *');
        });

        it('parses "every day at 2pm"', () => {
            expect(parseNaturalSchedule('every day at 2pm')).toBe('0 14 * * *');
        });

        it('parses "every morning"', () => {
            expect(parseNaturalSchedule('every morning')).toBe('0 8 * * *');
        });

        it('parses "every weekday"', () => {
            expect(parseNaturalSchedule('every weekday')).toBe('0 9 * * 1-5');
        });

        it('parses "every monday"', () => {
            expect(parseNaturalSchedule('every monday')).toBe('0 9 * * 1');
        });

        it('passes through valid cron expressions', () => {
            expect(parseNaturalSchedule('*/10 * * * *')).toBe('*/10 * * * *');
        });

        it('rejects unparseable input', () => {
            expect(() => parseNaturalSchedule('sometime next week')).toThrow('Cannot parse');
        });
    });

    // ─── CronScheduler ────────────────────────────────────────

    describe('CronScheduler', () => {
        let scheduler: CronScheduler;

        beforeEach(() => {
            scheduler = new CronScheduler({ enabled: false }); // disable auto-scheduling
        });

        afterEach(() => {
            scheduler.destroy();
        });

        it('creates a job', () => {
            const job = scheduler.createJob({
                name: 'test-job',
                schedule: '*/5 * * * *',
                action: 'message',
                payload: 'Hello!',
            });
            expect(job.id).toBeTruthy();
            expect(job.name).toBe('test-job');
            expect(job.status).toBe('active');
            expect(job.nextRunAt).toBeGreaterThan(0);
        });

        it('creates job from natural language', () => {
            const job = scheduler.createJob({
                name: 'daily',
                schedule: 'every day at 9am',
                action: 'message',
                payload: 'Good morning!',
            });
            expect(job.schedule.expression).toBe('0 9 * * *');
        });

        it('getJob retrieves job', () => {
            const job = scheduler.createJob({ name: 'x', schedule: '* * * * *', action: 'execute', payload: 'y' });
            expect(scheduler.getJob(job.id)!.name).toBe('x');
        });

        it('listJobs returns all jobs', () => {
            scheduler.createJob({ name: 'a', schedule: '* * * * *', action: 'execute', payload: '' });
            scheduler.createJob({ name: 'b', schedule: '* * * * *', action: 'execute', payload: '' });
            expect(scheduler.listJobs()).toHaveLength(2);
        });

        it('pauses and resumes job', () => {
            const job = scheduler.createJob({ name: 'x', schedule: '* * * * *', action: 'execute', payload: '' });
            expect(scheduler.pauseJob(job.id)).toBe(true);
            expect(scheduler.getJob(job.id)!.status).toBe('paused');
            expect(scheduler.resumeJob(job.id)).toBe(true);
            expect(scheduler.getJob(job.id)!.status).toBe('active');
        });

        it('deleteJob removes job', () => {
            const job = scheduler.createJob({ name: 'x', schedule: '* * * * *', action: 'execute', payload: '' });
            expect(scheduler.deleteJob(job.id)).toBe(true);
            expect(scheduler.getJob(job.id)).toBeUndefined();
        });

        it('fireNow executes immediately', async () => {
            let executed = false;
            scheduler.setExecutor(async (job) => {
                executed = true;
                return { jobId: job.id, jobName: job.name, startedAt: Date.now(), completedAt: Date.now(), success: true, durationMs: 0 };
            });
            const job = scheduler.createJob({ name: 'x', schedule: '* * * * *', action: 'execute', payload: '' });
            const result = await scheduler.fireNow(job.id);
            expect(result.success).toBe(true);
            expect(executed).toBe(true);
            expect(scheduler.getJob(job.id)!.runCount).toBe(1);
        });

        it('fireNow tracks failures', async () => {
            scheduler.setExecutor(async () => { throw new Error('executor crash'); });
            const job = scheduler.createJob({ name: 'x', schedule: '* * * * *', action: 'execute', payload: '' });
            const result = await scheduler.fireNow(job.id);
            expect(result.success).toBe(false);
            expect(result.error).toBe('executor crash');
            expect(scheduler.getJob(job.id)!.failCount).toBe(1);
        });

        it('getHistory returns run history', async () => {
            scheduler.setExecutor(async (job) => ({
                jobId: job.id, jobName: job.name, startedAt: Date.now(), completedAt: Date.now(), success: true, durationMs: 0,
            }));
            const job = scheduler.createJob({ name: 'x', schedule: '* * * * *', action: 'execute', payload: '' });
            await scheduler.fireNow(job.id);
            await scheduler.fireNow(job.id);
            expect(scheduler.getHistory(job.id)).toHaveLength(2);
        });

        it('getStats returns correct counts', () => {
            scheduler.createJob({ name: 'a', schedule: '* * * * *', action: 'execute', payload: '' });
            const job = scheduler.createJob({ name: 'b', schedule: '* * * * *', action: 'execute', payload: '' });
            scheduler.pauseJob(job.id);
            const stats = scheduler.getStats();
            expect(stats.totalJobs).toBe(2);
            expect(stats.activeJobs).toBe(1);
            expect(stats.pausedJobs).toBe(1);
        });

        it('listJobs filters by status', () => {
            scheduler.createJob({ name: 'a', schedule: '* * * * *', action: 'execute', payload: '' });
            const job = scheduler.createJob({ name: 'b', schedule: '* * * * *', action: 'execute', payload: '' });
            scheduler.pauseJob(job.id);
            expect(scheduler.listJobs({ status: 'active' })).toHaveLength(1);
            expect(scheduler.listJobs({ status: 'paused' })).toHaveLength(1);
        });
    });
});
