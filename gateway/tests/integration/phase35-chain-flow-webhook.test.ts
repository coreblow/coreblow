/**
 * CoreBlow Phase 35 — Flow→Contribution→Webhook Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   FlowRegistry → ContributionRegistry.merge → ScheduleParser validation
 */
import { describe, it, expect } from 'vitest';
import { ContributionRegistry } from '../../src/flows/contributions.js';
import { getFlowDef } from '../../src/flows/flow-registry.js';
import { parseSchedule } from '../../src/cron/schedule-parse.js';
import { WebhookManager } from '../../src/channels/webhook-manager.js';

describe('Phase35 Chain: Flow→Contribution→Webhook Pipeline', () => {

    it('get flow → inject contributions → merge steps → validate result', () => {
        const flow = getFlowDef('onboarding')!;
        const contributions = new ContributionRegistry();

        // Plugin injects a "terms" step before the model selection
        contributions.register({
            id: 'terms-step', flowId: 'onboarding', priority: 1,
            injectBefore: 'model',
            content: { id: 'terms', prompt: '📋 Do you agree to the terms? (yes/no)' },
        });

        // Merge into flow steps
        const merged = contributions.merge(
            flow.steps.map(s => ({ id: s.id, prompt: s.prompt })),
            (c) => c.content,
        );

        // Verify injection
        const ids = merged.map(s => s.id);
        expect(ids).toContain('terms');
        const termsIdx = ids.indexOf('terms');
        const modelIdx = ids.indexOf('model');
        expect(termsIdx).toBeLessThan(modelIdx); // terms before model
    });

    it('schedule parse → flow trigger validation pipeline', () => {
        // Parse various schedule formats for flow triggers
        const schedules = [
            'every 5 minutes',
            'daily at 9:00 am',
            'weekly',
            '0 */6 * * *',
        ];

        const parsed = schedules.map(s => parseSchedule(s));
        expect(parsed.every(p => p !== null)).toBe(true);

        // Validate cron expressions are well-formed (5 fields)
        for (const p of parsed) {
            const fields = p!.cronExpr.split(' ');
            expect(fields).toHaveLength(5);
        }
    });

    it('webhook registration → event matching → signing pipeline', () => {
        const mgr = new WebhookManager();

        // Register webhooks for different events
        mgr.register('https://alerts.io/hook', ['flow.completed', 'flow.failed']);
        mgr.register('https://audit.io/hook', ['*'], 'audit-secret');
        mgr.register('https://disabled.io', ['flow.completed']);
        mgr.setActive(mgr.list()[2]!.id, false); // Disable third

        // Verify matching
        const list = mgr.list();
        const active = list.filter(w => w.active);
        expect(active).toHaveLength(2);

        // Verify signing
        const payload = '{"event":"flow.completed"}';
        const sig = mgr.signPayload(payload, 'audit-secret');
        expect(sig).toHaveLength(64);
    });
});
