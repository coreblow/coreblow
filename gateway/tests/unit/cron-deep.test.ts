/**
 * Tests: Cron Module — Parsing, Scheduling, NLP
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
    parseCronExpression,
    cronMatchesDate,
    getNextCronTime,
    parseNaturalSchedule,
    CronScheduler,
} from '../../src/cron/scheduler.js';

describe('parseCronExpression', () => {
    it('parses standard 5-field cron', () => {
        const fields = parseCronExpression('*/5 * * * *');
        expect(fields).toBeDefined();
        expect(fields.length).toBe(5);
    });

    it('parses specific values', () => {
        expect(parseCronExpression('0 9 * * 1')).toBeDefined();
    });

    it('throws on invalid expression', () => {
        expect(() => parseCronExpression('invalid')).toThrow();
    });
});

describe('cronMatchesDate', () => {
    it('matches every-minute cron', () => {
        const fields = parseCronExpression('* * * * *');
        expect(cronMatchesDate(fields, new Date())).toBe(true);
    });

    it('matches specific time', () => {
        const fields = parseCronExpression('30 14 * * *');
        const date = new Date('2025-01-15T14:30:00');
        expect(cronMatchesDate(fields, date)).toBe(true);
    });
});

describe('getNextCronTime', () => {
    it('returns a Date', () => {
        const fields = parseCronExpression('0 * * * *');
        expect(getNextCronTime(fields)).toBeInstanceOf(Date);
    });
});

describe('parseNaturalSchedule', () => {
    it('parses "every 5 minutes"', () => {
        expect(parseNaturalSchedule('every 5 minutes')).toContain('*/5');
    });

    it('parses "every hour"', () => {
        expect(parseNaturalSchedule('every hour').length).toBeGreaterThan(0);
    });

    it('throws on unparseable text', () => {
        expect(() => parseNaturalSchedule('dfjkdfjk random xyz')).toThrow();
    });
});

describe('CronScheduler', () => {
    let scheduler: CronScheduler;

    afterEach(() => {
        scheduler?.destroy();
    });

    it('creates a scheduler', () => {
        scheduler = new CronScheduler();
        expect(scheduler).toBeDefined();
    });

    it('creates a job', () => {
        scheduler = new CronScheduler();
        const job = scheduler.createJob({
            name: 'test-job',
            schedule: '*/5 * * * *',
            action: 'send_message',
            payload: 'Hello!',
        });
        expect(job).toBeDefined();
        expect(job.id).toBeDefined();
    });

    it('lists jobs', () => {
        scheduler = new CronScheduler();
        scheduler.createJob({
            name: 'job1', schedule: '0 * * * *',
            action: 'send_message', payload: 'Test',
        });
        expect(scheduler.listJobs().length).toBeGreaterThanOrEqual(1);
    });

    it('deletes a job', () => {
        scheduler = new CronScheduler();
        const job = scheduler.createJob({
            name: 'to-delete', schedule: '0 * * * *',
            action: 'send_message', payload: '',
        });
        expect(scheduler.deleteJob(job.id)).toBe(true);
    });

    it('pauses and resumes', () => {
        scheduler = new CronScheduler();
        const job = scheduler.createJob({
            name: 'pausable', schedule: '0 * * * *',
            action: 'send_message', payload: '',
        });
        expect(scheduler.pauseJob(job.id)).toBe(true);
        expect(scheduler.resumeJob(job.id)).toBe(true);
    });

    it('reports stats', () => {
        scheduler = new CronScheduler();
        scheduler.createJob({
            name: 'stat-job', schedule: '0 * * * *',
            action: 'send_message', payload: '',
        });
        expect(scheduler.getStats().totalJobs).toBeGreaterThanOrEqual(1);
    });
});
