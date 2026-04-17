/**
 * CoreBlow Phase 23 — Validation & Scheduling Tests
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { InputValidator } from '../../src/security/input-validator.js';
import { CronScheduler } from '../../src/infra/cron-scheduler.js';
import { NotificationSystem } from '../../src/infra/notification-system.js';
import { AnalyticsTracker } from '../../src/observability/analytics-tracker.js';
import { ErrorReporter } from '../../src/observability/error-reporter.js';

// ================================================================
// Input Validator Tests
// ================================================================
describe('InputValidator', () => {
    const v = new InputValidator();

    it('should validate required fields', () => {
        const result = v.validate({}, { name: { type: 'string', required: true } });
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.field).toBe('name');
    });

    it('should validate string types', () => {
        const result = v.validate({ name: 123 }, { name: { type: 'string' } });
        expect(result.valid).toBe(false);
    });

    it('should validate string length', () => {
        const result = v.validate({ name: 'ab' }, { name: { type: 'string', minLength: 3 } });
        expect(result.valid).toBe(false);
    });

    it('should validate numbers', () => {
        const result = v.validate({ age: 5 }, { age: { type: 'number', min: 18 } });
        expect(result.valid).toBe(false);
    });

    it('should validate emails', () => {
        expect(v.isEmail('test@example.com')).toBe(true);
        expect(v.isEmail('invalid')).toBe(false);
    });

    it('should validate URLs', () => {
        expect(v.isURL('https://example.com')).toBe(true);
        expect(v.isURL('not-url')).toBe(false);
    });

    it('should sanitize XSS', () => {
        expect(v.sanitizeString('<script>alert("xss")</script>')).not.toContain('<script>');
    });

    it('should pass valid data', () => {
        const result = v.validate({ name: 'Alice', age: 25 }, {
            name: { type: 'string', required: true, minLength: 2 },
            age: { type: 'number', min: 0, max: 150 },
        });
        expect(result.valid).toBe(true);
    });

    it('should run custom validators', () => {
        const result = v.validate({ code: 'abc' }, {
            code: { type: 'string', custom: (v) => String(v).length !== 6 ? 'Code must be 6 chars' : null },
        });
        expect(result.valid).toBe(false);
    });
});

// ================================================================
// Cron Scheduler Tests
// ================================================================
describe('CronScheduler', () => {
    let scheduler: CronScheduler;
    afterEach(() => { scheduler?.stopAll(); });

    it('should schedule jobs', () => {
        scheduler = new CronScheduler();
        const id = scheduler.schedule('test', 60000, () => {});
        expect(id).toBeTruthy();
        expect(scheduler.count()).toBe(1);
    });

    it('should pause and resume', () => {
        scheduler = new CronScheduler();
        const id = scheduler.schedule('test', 60000, () => {});
        expect(scheduler.pause(id)).toBe(true);
        expect(scheduler.get(id)?.status).toBe('paused');
        expect(scheduler.resume(id)).toBe(true);
        expect(scheduler.get(id)?.status).toBe('active');
    });

    it('should cancel jobs', () => {
        scheduler = new CronScheduler();
        const id = scheduler.schedule('test', 60000, () => {});
        expect(scheduler.cancel(id)).toBe(true);
    });

    it('should list jobs', () => {
        scheduler = new CronScheduler();
        scheduler.schedule('a', 60000, () => {});
        scheduler.schedule('b', 60000, () => {});
        expect(scheduler.list()).toHaveLength(2);
    });

    it('should run jobs', async () => {
        scheduler = new CronScheduler();
        let ran = false;
        scheduler.schedule('fast', 50, () => { ran = true; });
        await new Promise((r) => setTimeout(r, 100));
        expect(ran).toBe(true);
    });

    it('should stop all', () => {
        scheduler = new CronScheduler();
        scheduler.schedule('a', 60000, () => {});
        scheduler.schedule('b', 60000, () => {});
        expect(scheduler.stopAll()).toBe(2);
    });
});

// ================================================================
// Notification System Tests
// ================================================================
describe('NotificationSystem', () => {
    let notifs: NotificationSystem;
    beforeEach(() => { notifs = new NotificationSystem(); });

    it('should send notifications', () => {
        notifs.send('info', 'Test', 'Hello', 'user1');
        expect(notifs.count()).toBe(1);
    });

    it('should get user notifications', () => {
        notifs.send('info', 'A', 'Msg', 'user1');
        notifs.send('info', 'B', 'Msg', 'user2');
        expect(notifs.getForUser('user1')).toHaveLength(1);
    });

    it('should mark as read', () => {
        const n = notifs.send('info', 'Test', 'Msg', 'user1');
        notifs.markRead(n.id);
        expect(notifs.getForUser('user1', true)).toHaveLength(0);
    });

    it('should mark all read', () => {
        notifs.send('info', 'A', 'Msg', 'user1');
        notifs.send('info', 'B', 'Msg', 'user1');
        expect(notifs.markAllRead('user1')).toBe(2);
    });

    it('should count unread', () => {
        notifs.send('info', 'A', 'Msg', 'user1');
        notifs.send('info', 'B', 'Msg', 'user1');
        expect(notifs.getUnreadCount('user1')).toBe(2);
    });

    it('should respect preferences', () => {
        notifs.setPreferences('user1', { enabled: false, channels: [], types: ['info'] });
        notifs.send('info', 'Blocked', 'Msg', 'user1');
        expect(notifs.getForUser('user1')).toHaveLength(0);
    });

    it('should get recent', () => {
        notifs.send('info', 'A', 'Msg');
        notifs.send('error', 'B', 'Msg');
        expect(notifs.getRecent(1)).toHaveLength(1);
    });
});

// ================================================================
// Analytics Tracker Tests
// ================================================================
describe('AnalyticsTracker', () => {
    let tracker: AnalyticsTracker;
    beforeEach(() => { tracker = new AnalyticsTracker(); });

    it('should track events', () => {
        tracker.track('message', 'chat', { userId: 'u1', channel: 'discord' });
        expect(tracker.count()).toBe(1);
    });

    it('should count by name', () => {
        tracker.track('message', 'chat');
        tracker.track('message', 'chat');
        tracker.track('error', 'system');
        expect(tracker.countByName('message')).toBe(2);
    });

    it('should summarize', () => {
        tracker.track('message', 'chat', { userId: 'u1', channel: 'discord' });
        tracker.track('command', 'cli', { userId: 'u2', channel: 'telegram' });
        const summary = tracker.summarize();
        expect(summary.totalEvents).toBe(2);
        expect(summary.uniqueUsers).toBe(2);
    });

    it('should get user events', () => {
        tracker.track('a', 'cat', { userId: 'u1' });
        tracker.track('b', 'cat', { userId: 'u2' });
        expect(tracker.getUserEvents('u1')).toHaveLength(1);
    });

    it('should export', () => {
        tracker.track('a', 'b');
        expect(tracker.export()).toHaveLength(1);
    });

    it('should clear', () => {
        tracker.track('a', 'b');
        tracker.clear();
        expect(tracker.count()).toBe(0);
    });
});

// ================================================================
// Error Reporter Tests
// ================================================================
describe('ErrorReporter', () => {
    let reporter: ErrorReporter;
    beforeEach(() => { reporter = new ErrorReporter(); });

    it('should report errors', () => {
        reporter.report(new Error('test'), 'gateway');
        expect(reporter.count()).toBe(1);
    });

    it('should deduplicate', () => {
        reporter.report(new Error('dup'), 'src');
        reporter.report(new Error('dup'), 'src');
        expect(reporter.count()).toBe(1);
        expect(reporter.getTopErrors()[0]!.count).toBe(2);
    });

    it('should resolve errors', () => {
        const report = reporter.report('bug', 'test');
        expect(reporter.resolve(report.id)).toBe(true);
    });

    it('should get unresolved', () => {
        reporter.report('a', 'test');
        reporter.report('b', 'test');
        expect(reporter.getUnresolved()).toHaveLength(2);
    });

    it('should alert on critical', () => {
        reporter.report('crash', 'core', 'critical');
        expect(reporter.getAlerts()).toHaveLength(1);
    });

    it('should get stats', () => {
        reporter.report('a', 'test', 'critical');
        reporter.report('b', 'test', 'low');
        const stats = reporter.getStats();
        expect(stats.total).toBe(2);
        expect(stats.critical).toBe(1);
    });

    it('should clear resolved', () => {
        const r = reporter.report('a', 'test');
        reporter.resolve(r.id);
        expect(reporter.clearResolved()).toBe(1);
    });
});
