/**
 * Tests: Flows Module — FlowEngine, FlowRegistry
 */
import { describe, it, expect } from 'vitest';
import { FlowEngine, getFlowEngine } from '../../src/flows/flow-engine.js';
import { registerFlow, getFlowDef, listFlows } from '../../src/flows/flow-registry.js';

describe('FlowEngine', () => {
    it('creates engine', () => {
        const engine = new FlowEngine();
        expect(engine).toBeDefined();
    });

    it('getFlowEngine returns singleton', () => {
        const a = getFlowEngine();
        const b = getFlowEngine();
        expect(a).toBe(b);
    });

    it('starts a flow with array steps', async () => {
        const engine = new FlowEngine();
        const flow = await engine.start({
            name: 'test-flow',
            description: 'A test flow',
            initialStep: 'start',
            steps: [
                { id: 'start', prompt: 'What is your name?', next: 'end' },
                { id: 'end', prompt: 'Done!' },
            ],
        }, 'session-1');
        expect(flow.id).toBeDefined();
        expect(flow.currentStep).toBe('start');
    });
});

describe('FlowRegistry', () => {
    it('registers a flow definition', () => {
        registerFlow({
            name: 'reg-test',
            description: 'Registry test',
            initialStep: 'start',
            steps: [{ id: 'start', prompt: 'Hello' }],
        });
        expect(getFlowDef('reg-test')).toBeDefined();
    });

    it('returns undefined for unknown flow', () => {
        expect(getFlowDef('nonexistent-flow-xyz')).toBeUndefined();
    });

    it('lists all registered flows', () => {
        registerFlow({
            name: 'list-test',
            description: 'List test',
            initialStep: 'start',
            steps: [{ id: 'start', prompt: 'Hi' }],
        });
        const all = listFlows();
        expect(all.length).toBeGreaterThan(0);
    });
});
