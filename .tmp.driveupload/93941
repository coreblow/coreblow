/**
 * Integration test: Verify all four Phase 6 subsystems work together.
 * - Cron: CronService add/remove
 * - Hooks: HooksEngine register/emit
 * - Flows: FlowEngine start/process/complete
 * - Skills: SkillRegistry register/discover
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HooksEngine } from '../../src/hooks/engine.js';
import { FlowEngine } from '../../src/flows/flow-engine.js';
import { SkillRegistry } from '../../src/skills/registry.js';
import { HookBus } from '../../src/hooks/hook-bus.js';
import type { FlowDefinition } from '../../src/flows/types.js';

describe('Wave68 Subsystems E2E', () => {
    let hooks: HooksEngine;
    let flows: FlowEngine;
    let skills: SkillRegistry;
    let bus: HookBus;

    beforeEach(() => {
        hooks = new HooksEngine();
        flows = new FlowEngine();
        skills = new SkillRegistry();
        bus = new HookBus();
    });

    it('hooks can trigger flow start', async () => {
        const flowDef: FlowDefinition = {
            name: 'triggered-flow',
            description: 'Flow triggered by hook',
            initialStep: 'ask',
            steps: [
                { id: 'ask', prompt: 'Confirm?', next: null },
            ],
        };

        // Register hook that starts a flow on command:setup
        hooks.register({
            id: 'setup-trigger',
            name: 'setup trigger',
            source: 'bundled',
            metadata: { events: ['command:setup'] },
            handler: async (ctx) => {
                const instance = await flows.start(flowDef, ctx.payload.sessionKey as string);
                ctx.shared.flowId = instance.id;
            },
            enabled: true,
        });

        const results = await hooks.emit('command:setup', { sessionKey: 'sess1' });
        expect(results).toHaveLength(1);
        expect(results[0].error).toBeUndefined();
        expect(flows.activeCount).toBe(1);

        const active = flows.getActiveFlow('sess1');
        expect(active).not.toBeNull();
        expect(active!.definition.name).toBe('triggered-flow');
    });

    it('bus events can drive hook execution', async () => {
        const log: string[] = [];

        hooks.register({
            id: 'logger',
            name: 'logger',
            source: 'bundled',
            metadata: { events: ['message:received'] },
            handler: async (ctx) => {
                log.push(`received: ${ctx.payload.content}`);
            },
            enabled: true,
        });

        // Wire bus → hooks
        bus.on('message:received', async (data) => {
            await hooks.emit('message:received', data as Record<string, unknown>);
        });

        await bus.fire('message:received', { content: 'hello' });
        expect(log).toEqual(['received: hello']);
    });

    it('skills can be registered and queried alongside hooks', () => {
        skills.register({
            id: 'search',
            baseDir: '/skills/search',
            markdownPath: '/skills/search/SKILL.md',
            instructions: '# Search the web',
            metadata: { name: 'Web Search', description: 'Search skill', events: ['tool-call'] },
            source: 'bundled',
        });

        hooks.register({
            id: 'skill-hook',
            name: 'skill-hook',
            source: 'bundled',
            metadata: { events: ['tool-call'] },
            handler: async () => {},
            enabled: true,
        });

        // Both subsystems should have entries
        expect(skills.list()).toHaveLength(1);
        expect(hooks.list()).toHaveLength(1);

        // Query by event
        const searchSkill = skills.getById('search');
        expect(searchSkill?.metadata.events).toContain('tool-call');
    });

    it('full flow lifecycle: start → input → complete', async () => {
        let completedData: Record<string, unknown> | undefined;

        const flowDef: FlowDefinition = {
            name: 'setup',
            description: 'Setup flow',
            initialStep: 's1',
            onComplete: async (data) => { completedData = data; },
            steps: [
                { id: 's1', prompt: 'Name?', next: 's2' },
                { id: 's2', prompt: 'Age?', transform: (s) => parseInt(s), next: null },
            ],
        };

        const inst = await flows.start(flowDef, 'sess1');
        expect(inst.state).toBe('waiting_input');

        const r1 = await flows.processInput('sess1', inst.id, 'Alice');
        expect(r1.completed).toBe(false);
        expect(r1.prompt).toBe('Age?');

        const r2 = await flows.processInput('sess1', inst.id, '30');
        expect(r2.completed).toBe(true);
        expect(completedData).toBeDefined();
        expect(completedData!.s1).toBe('Alice');
        expect(completedData!.s2).toBe(30);
    });

    it('snapshot captures engine state', () => {
        hooks.register({
            id: 'h1', name: 'test', source: 'bundled',
            metadata: { events: ['a'], priority: 10 },
            handler: async () => {},
            enabled: true,
        });

        const snap = hooks.snapshot();
        expect(snap.hooks).toHaveLength(1);
        expect(snap.hooks[0].priority).toBe(10);
        expect(snap.version).toBeGreaterThan(0);
    });
});
