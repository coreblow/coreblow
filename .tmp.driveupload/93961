/**
 * Integration test: Flow ↔ Cron interaction scenarios.
 * Tests that flows can schedule cron work, and cron events can trigger flows.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FlowEngine } from '../../src/flows/flow-engine.js';
import { HooksEngine } from '../../src/hooks/engine.js';
import { ContributionRegistry } from '../../src/flows/contributions.js';
import type { FlowDefinition } from '../../src/flows/types.js';

describe('Wave68 Flow-Cron Integration', () => {
    let flows: FlowEngine;
    let hooks: HooksEngine;

    beforeEach(() => {
        flows = new FlowEngine();
        hooks = new HooksEngine();
    });

    it('cron event triggers a flow via hooks', async () => {
        const flowDef: FlowDefinition = {
            name: 'cron-report',
            description: 'Report flow triggered by cron',
            initialStep: 'report',
            steps: [
                { id: 'report', prompt: 'Generating report...', next: null },
            ],
        };

        hooks.register({
            id: 'cron-flow-trigger',
            name: 'cron-flow-trigger',
            source: 'bundled',
            metadata: { events: ['cron:run'] },
            handler: async (ctx) => {
                const sessKey = (ctx.payload.sessionKey as string) || 'cron-session';
                await flows.start(flowDef, sessKey);
            },
            enabled: true,
        });

        await hooks.emit('cron:run', { sessionKey: 'cron-sess', jobName: 'daily-report' });
        expect(flows.activeCount).toBe(1);
        expect(flows.getActiveFlow('cron-sess')).not.toBeNull();
    });

    it('flow completion emits hook event', async () => {
        const emitted: string[] = [];

        hooks.register({
            id: 'flow-done-listener',
            name: 'flow-done-listener',
            source: 'bundled',
            metadata: { events: ['flow:completed'] },
            handler: async (ctx) => {
                emitted.push(ctx.payload.flowName as string);
            },
            enabled: true,
        });

        const flowDef: FlowDefinition = {
            name: 'quick-flow',
            description: 'Quick flow that completes',
            initialStep: 'only',
            onComplete: async () => {
                await hooks.emit('flow:completed', { flowName: 'quick-flow' });
            },
            steps: [
                { id: 'only', prompt: 'Done?', next: null },
            ],
        };

        const inst = await flows.start(flowDef, 'sess1');
        await flows.processInput('sess1', inst.id, 'yes');

        expect(emitted).toEqual(['quick-flow']);
    });

    it('contribution registry can extend flow steps dynamically', () => {
        const contributions = new ContributionRegistry();

        contributions.register({
            id: 'extra-check',
            flowId: 'setup',
            priority: 10,
            injectAfter: 's1',
            content: { id: 'extra', label: 'Extra validation' },
        });

        const baseSteps = [
            { id: 's1', label: 'Step 1' },
            { id: 's2', label: 'Step 2' },
        ];

        const merged = contributions.merge(baseSteps, (c) => c.content);
        expect(merged.map(s => s.id)).toEqual(['s1', 'extra', 's2']);
    });

    it('cleanExpired handles concurrent active flows', async () => {
        const flowDef: FlowDefinition = {
            name: 'short-lived',
            description: 'Expires quickly',
            initialStep: 's1',
            timeoutMs: 1,
            steps: [{ id: 's1', prompt: 'Wait...', next: null }],
        };

        await flows.start(flowDef, 'sess1');
        await flows.start(flowDef, 'sess2');
        await flows.start(flowDef, 'sess3');

        await new Promise(r => setTimeout(r, 10));
        const cleaned = await flows.cleanExpired();
        expect(cleaned).toBe(3);
        expect(flows.activeCount).toBe(0);
    });

    it('hook wildcard catches all cron events', async () => {
        const events: string[] = [];

        hooks.register({
            id: 'cron-monitor',
            name: 'cron-monitor',
            source: 'bundled',
            metadata: { events: ['cron:*'] },
            handler: async (ctx) => { events.push(ctx.event); },
            enabled: true,
        });

        await hooks.emit('cron:run', {});
        await hooks.emit('cron:skipped', {});
        await hooks.emit('cron:error', {});

        expect(events).toEqual(['cron:run', 'cron:skipped', 'cron:error']);
    });
});
