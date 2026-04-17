import { describe, it, expect, beforeEach } from 'vitest';
import { I18n } from './i18n.js';
import { NotificationSystem } from './notification-system.js';
import { WorkflowEngine } from './workflow-engine.js';

// ─── I18n ──────────────────────────────────────────────────────

describe('I18n System — Phase 19', () => {
    let i18n: I18n;

    beforeEach(() => {
        i18n = new I18n(); // default en
    });

    it('translates simple key', () => {
        expect(i18n.t('app.name')).toBe('CoreBlow');
    });

    it('returns key if not found', () => {
        expect(i18n.t('unknown.key')).toBe('unknown.key');
    });

    it('interpolates params', () => {
        expect(i18n.t('error.not_found', { resource: 'user' })).toBe('Not found: user');
    });

    it('keeps missing interpolation params', () => {
        expect(i18n.t('error.not_found')).toBe('Not found: {{resource}}');
    });

    it('pluralizes one', () => {
        expect(i18n.tp('plural.message', 1)).toBe('1 message');
    });

    it('pluralizes other', () => {
        expect(i18n.tp('plural.message', 5)).toBe('5 messages');
        expect(i18n.tp('plural.message', 0)).toBe('0 messages');
    });

    it('changes locale and translates', () => {
        i18n.setLocale('id');
        expect(i18n.t('app.description')).toBe('Gerbang AI');
        expect(i18n.tp('plural.message', 5)).toBe('5 pesan');
    });

    it('falls back to default locale', () => {
        i18n.setLocale('id');
        // 'agent.greeting' is in 'id', but if we add a new key to 'en', it should fallback
        i18n.addLocale('en', { new_key: 'hello' });
        expect(i18n.t('new_key')).toBe('hello');
    });

    it('setLocale returns false for unknown', () => {
        expect(i18n.setLocale('fr')).toBe(false);
        expect(i18n.getLocale()).toBe('en');
    });

    it('has checks key existence', () => {
        expect(i18n.has('app.name')).toBe(true);
        expect(i18n.has('missing')).toBe(false);
    });

    it('listLocales returns available', () => {
        const locales = i18n.listLocales();
        expect(locales).toContain('en');
        expect(locales).toContain('id');
    });

    it('tp returns key for non-existent plural key', () => {
        expect(i18n.tp('missing.plural', 3)).toBe('missing.plural');
    });
});

// ─── Notification System ────────────────────────────────────────

describe('Notification System — Phase 19', () => {
    let notify: NotificationSystem;

    beforeEach(() => {
        notify = new NotificationSystem();
    });

    it('sends notification', () => {
        const n = notify.send('info', 'Hello', 'World', 'user1');
        expect(n.id).toMatch(/^notif-/);
        expect(notify.count()).toBe(1);
    });

    it('getForUser filters by user', () => {
        notify.send('info', 'U1', 'msg', 'user1');
        notify.send('info', 'U2', 'msg', 'user2');
        expect(notify.getForUser('user1')).toHaveLength(1);
    });

    it('getForUser filters unread', () => {
        const n = notify.send('info', 'U1', 'msg', 'user1');
        notify.markRead(n.id);
        notify.send('info', 'U1', 'msg', 'user1');
        expect(notify.getForUser('user1', true)).toHaveLength(1);
    });

    it('markRead returns false for unknown', () => {
        expect(notify.markRead('unknown')).toBe(false);
    });

    it('markAllRead marks all for user', () => {
        notify.send('info', 'A', '1', 'u1');
        notify.send('info', 'B', '2', 'u1');
        notify.send('info', 'C', '3', 'u2');
        const count = notify.markAllRead('u1');
        expect(count).toBe(2);
        expect(notify.getUnreadCount('u1')).toBe(0);
        expect(notify.getUnreadCount('u2')).toBe(1);
    });

    it('preferences block disabled notifications', () => {
        notify.setPreferences('u1', { enabled: false, channels: [], types: ['info'] });
        notify.send('info', 'Title', 'Msg', 'u1');
        expect(notify.getForUser('u1')).toHaveLength(0);
    });

    it('preferences block muted notifications', () => {
        notify.setPreferences('u1', { enabled: true, channels: [], types: ['info'], muteUntil: Date.now() + 10000 });
        notify.send('info', 'Title', 'Msg', 'u1');
        expect(notify.getForUser('u1')).toHaveLength(0);
    });

    it('preferences filter by type', () => {
        notify.setPreferences('u1', { enabled: true, channels: [], types: ['error'] });
        notify.send('info', 'Title', 'Msg', 'u1'); // blocked
        notify.send('error', 'Title', 'Msg', 'u1'); // allowed
        expect(notify.getForUser('u1')).toHaveLength(1);
    });

    it('getRecent limits result', () => {
        for (let i = 0; i < 5; i++) notify.send('info', 'T', 'M');
        expect(notify.getRecent(3)).toHaveLength(3);
    });

    it('clearExpired removes old', () => {
        const n1 = notify.send('info', 'T', 'M');
        n1.expiresAt = Date.now() - 1000;
        const n2 = notify.send('info', 'T', 'M');
        n2.expiresAt = Date.now() + 10000;
        const cleared = notify.clearExpired();
        expect(cleared).toBe(1);
        expect(notify.count()).toBe(1);
    });
});

// ─── Workflow Engine ──────────────────────────────────────────

describe('Workflow Engine — Phase 19', () => {
    let engine: WorkflowEngine;

    beforeEach(() => {
        engine = new WorkflowEngine();
        engine.register({
            id: 'simple',
            name: 'Simple Workflow',
            steps: [
                { id: 's1', name: 'Step 1', handler: async (ctx) => ({ val: 1 }) },
                { id: 's2', name: 'Step 2', handler: async (ctx) => ({ val: 2 }) },
            ]
        });
    });

    it('executes successful workflow', async () => {
        const result = await engine.execute('simple');
        expect(result.status).toBe('completed');
        expect(result.stepsExecuted).toBe(2);
        expect(result.context.stepResults['s1']).toEqual({ val: 1 });
    });

    it('returns failed for unknown workflow', async () => {
        const result = await engine.execute('unknown');
        expect(result.status).toBe('failed');
        expect(result.context.errors[0].error).toBe('Workflow not found');
    });

    it('skips step if condition false', async () => {
        engine.register({
            id: 'cond',
            name: 'Conditional',
            steps: [
                { id: 's1', name: 'S1', condition: () => false, handler: async () => 'skipped' },
                { id: 's2', name: 'S2', handler: async () => 'run' },
            ]
        });
        const result = await engine.execute('cond');
        expect(result.stepsExecuted).toBe(1);
        expect(result.stepsSkipped).toBe(1);
        expect(result.context.stepResults['s2']).toBe('run');
    });

    it('stops on error by default', async () => {
        engine.register({
            id: 'err',
            name: 'Error',
            steps: [
                { id: 's1', name: 'S1', handler: async () => { throw new Error('boom'); } },
                { id: 's2', name: 'S2', handler: async () => 'never' },
            ]
        });
        const result = await engine.execute('err');
        expect(result.status).toBe('failed');
        expect(result.stepsExecuted).toBe(0);
        expect(result.context.errors[0].error).toBe('boom');
    });

    it('skips on error if configured', async () => {
        engine.register({
            id: 'err-skip',
            name: 'Error Skip',
            steps: [
                { id: 's1', name: 'S1', onError: 'skip', handler: async () => { throw new Error('boom'); } },
                { id: 's2', name: 'S2', handler: async () => 'ok' },
            ]
        });
        const result = await engine.execute('err-skip');
        expect(result.status).toBe('partial');
        expect(result.stepsExecuted).toBe(1);
        expect(result.stepsSkipped).toBe(1);
    });

    it('retries on error', async () => {
        let calls = 0;
        engine.register({
            id: 'err-retry',
            name: 'Error Retry',
            steps: [
                {
                    id: 's1', name: 'S1', maxRetries: 2, handler: async () => {
                        calls++;
                        if (calls < 3) throw new Error('fail');
                        return 'ok';
                    }
                },
            ]
        });
        const result = await engine.execute('err-retry');
        expect(result.status).toBe('completed');
        expect(calls).toBe(3);
        expect(result.context.stepResults['s1']).toBe('ok');
    });

    it('fails after max retries', async () => {
        engine.register({
            id: 'err-fail',
            name: 'Error Fail',
            steps: [
                { id: 's1', name: 'S1', maxRetries: 1, handler: async () => { throw new Error('fail'); } },
            ]
        });
        const result = await engine.execute('err-fail');
        expect(result.status).toBe('failed');
        expect(result.context.errors).toHaveLength(1);
    });

    it('passes initial data', async () => {
        engine.register({
            id: 'data',
            name: 'Data',
            steps: [
                { id: 's1', name: 'S1', handler: async (ctx) => ctx.data.input }
            ]
        });
        const result = await engine.execute('data', { input: 'test' });
        expect(result.context.stepResults['s1']).toBe('test');
    });

    it('history and stats', async () => {
        await engine.execute('simple');
        expect(engine.getHistory()).toHaveLength(1);
        expect(engine.count()).toBe(1);
        expect(engine.list()).toHaveLength(1);
        expect(engine.get('simple')!.name).toBe('Simple Workflow');
    });
});
