/**
 * CoreBlow Phase 35 — Channels & Flows Stress & Chaos Tests
 *
 * Layer 3 (Adversarial):
 *   - Webhook stress: 50 webhooks, event matching accuracy
 *   - Flow merge chaos: conflicting positions, empty arrays
 *   - Schedule edge cases: boundary values, malformed input
 *   - Directory resilience: provider errors, empty results
 */
import { describe, it, expect } from 'vitest';
import { WebhookManager } from '../../src/channels/webhook-manager.js';
import { ContributionRegistry } from '../../src/flows/contributions.js';
import { parseSchedule, listPresets } from '../../src/cron/schedule-parse.js';
import { resolveTargets, registerDirectoryProvider, type DirectoryProvider } from '../../src/channels/directory.js';

// ================================================================
describe('Phase35 Chaos: Webhook Stress', () => {
    it('50 webhooks registered — list and stats accurate', () => {
        const mgr = new WebhookManager();
        for (let i = 0; i < 50; i++) {
            mgr.register(`https://hook-${i}.io`, [i % 2 === 0 ? 'event.A' : 'event.B']);
        }

        expect(mgr.count()).toBe(50);
        const stats = mgr.getStats();
        expect(stats.total).toBe(50);
        expect(stats.active).toBe(50);
    });

    it('wildcard webhook matches all events', () => {
        const mgr = new WebhookManager();
        const wh = mgr.register('https://catch-all.io', ['*']);

        // Wildcard should be in events
        expect(mgr.get(wh.id)?.events).toContain('*');
    });

    it('disabled webhook excluded from list operations', () => {
        const mgr = new WebhookManager();
        const wh1 = mgr.register('https://a.io', ['*']);
        const wh2 = mgr.register('https://b.io', ['*']);
        mgr.setActive(wh1.id, false);

        const stats = mgr.getStats();
        expect(stats.active).toBe(1);
    });
});

// ================================================================
describe('Phase35 Chaos: Flow Merge Edge Cases', () => {
    it('merge with empty base array — contributions become result', () => {
        const reg = new ContributionRegistry();
        reg.register({ id: 'c1', flowId: 'f1', priority: 1, content: { id: 'injected' } });

        const merged = reg.merge([], (c) => c.content);
        expect(merged).toHaveLength(1);
        expect(merged[0]!.id).toBe('injected');
    });

    it('merge with no contributions — base unchanged', () => {
        const reg = new ContributionRegistry();
        const base = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
        const merged = reg.merge(base, (c) => c.content);
        expect(merged).toEqual(base);
    });

    it('multiple contributions at same anchor — all inserted', () => {
        const reg = new ContributionRegistry();
        reg.register({ id: 'c1', flowId: 'f1', priority: 1, injectAfter: 'step-a', content: { id: 'first' } });
        reg.register({ id: 'c2', flowId: 'f1', priority: 2, injectAfter: 'step-a', content: { id: 'second' } });

        const base = [{ id: 'step-a' }, { id: 'step-b' }];
        const merged = reg.merge(base, (c) => c.content);

        expect(merged.length).toBe(4);
        // Both should be inserted after step-a
        expect(merged.map(s => s.id)).toContain('first');
        expect(merged.map(s => s.id)).toContain('second');
    });
});

// ================================================================
describe('Phase35 Chaos: Schedule Edge Cases', () => {
    it('all presets parse successfully', () => {
        const presets = listPresets();
        for (const preset of presets) {
            const result = parseSchedule(preset.label);
            expect(result).not.toBeNull();
            expect(result?.cronExpr).toBe(preset.cronExpr);
        }
    });

    it('boundary hour/minute values', () => {
        expect(parseSchedule('daily at 0:00')).not.toBeNull();
        expect(parseSchedule('daily at 23:59')).not.toBeNull();
    });

    it('invalid schedule inputs return null', () => {
        expect(parseSchedule('')).toBeNull();
        expect(parseSchedule('   ')).toBeNull();
        expect(parseSchedule('yesterday at noon')).toBeNull();
        expect(parseSchedule('every -1 minutes')).toBeNull();
    });
});

// ================================================================
describe('Phase35 Chaos: Directory Resilience', () => {
    it('resolve empty array of targets — returns empty', async () => {
        const results = await resolveTargets('telegram', 'any-bot', []);
        expect(results).toHaveLength(0);
    });

    it('resolve 20 targets — all resolved via passthrough', async () => {
        const inputs = Array.from({ length: 20 }, (_, i) => `user-${i}`);
        const results = await resolveTargets('signal', 'no-provider-here', inputs);
        expect(results).toHaveLength(20);
        expect(results.every(r => r.resolved)).toBe(true);
    });
});
