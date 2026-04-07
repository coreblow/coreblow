// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { FlowEngine } from './flow-engine.js';
import { registerFlow, getFlowDef, listFlows, onboardingFlow, feedbackFlow } from './flow-registry.js';

describe('Flows — Phase 9', () => {

    // ─── Flow Engine ───────────────────────────────────────────

    describe('FlowEngine', () => {
        let engine: FlowEngine;
        const simpleFlow = {
            name: 'test-flow',
            description: 'A test flow',
            initialStep: 'step1',
            steps: [
                { id: 'step1', prompt: 'Enter name:', next: 'step2' },
                { id: 'step2', prompt: 'Enter age:', next: null },
            ],
        };

        beforeEach(() => {
            engine = new FlowEngine();
        });

        it('starts a flow', async () => {
            const instance = await engine.start(simpleFlow, 'session-1');
            expect(instance.id).toBeTruthy();
            expect(instance.state).toBe('waiting_input');
            expect(instance.currentStep).toBe('step1');
            expect(engine.activeCount).toBe(1);
        });

        it('processes input and advances step', async () => {
            const instance = await engine.start(simpleFlow, 'session-1');
            const result = await engine.processInput('session-1', instance.id, 'Alice');
            expect(result.completed).toBe(false);
            expect(result.prompt).toBe('Enter age:');
        });

        it('completes flow on final step', async () => {
            const instance = await engine.start(simpleFlow, 'session-1');
            await engine.processInput('session-1', instance.id, 'Alice');
            const result = await engine.processInput('session-1', instance.id, '25');
            expect(result.completed).toBe(true);
            expect(engine.activeCount).toBe(0);
        });

        it('validates input', async () => {
            const validatedFlow = {
                name: 'validated',
                initialStep: 's1',
                steps: [{
                    id: 's1', prompt: 'Enter 1-5:',
                    validator: (input) => ({ valid: /^[1-5]$/.test(input), error: 'Must be 1-5' }),
                    next: null,
                }],
            };
            const instance = await engine.start(validatedFlow, 'session-1');
            const bad = await engine.processInput('session-1', instance.id, '99');
            expect(bad.completed).toBe(false);
            expect(bad.prompt).toContain('1-5');
            const good = await engine.processInput('session-1', instance.id, '3');
            expect(good.completed).toBe(true);
        });

        it('transforms input', async () => {
            let captured = null;
            const transformFlow = {
                name: 'transform',
                initialStep: 's1',
                steps: [{
                    id: 's1', prompt: 'Number:',
                    transform: (input) => parseInt(input),
                    next: null,
                }],
                onComplete: async (data) => { captured = data; },
            };
            const instance = await engine.start(transformFlow, 'session-1');
            await engine.processInput('session-1', instance.id, '42');
            expect(captured.s1).toBe(42);
        });

        it('cancels flow', async () => {
            const instance = await engine.start(simpleFlow, 'session-1');
            await engine.cancel('session-1', instance.id);
            expect(engine.activeCount).toBe(0);
        });

        it('getActiveFlow returns active flow', async () => {
            await engine.start(simpleFlow, 'session-1');
            const active = engine.getActiveFlow('session-1');
            expect(active).not.toBeNull();
            expect(active!.state).toBe('waiting_input');
        });

        it('getActiveFlow returns null when no active', () => {
            expect(engine.getActiveFlow('session-999')).toBeNull();
        });

        it('listFlows filters by session', async () => {
            await engine.start(simpleFlow, 'session-1');
            await engine.start(simpleFlow, 'session-2');
            expect(engine.listFlows('session-1')).toHaveLength(1);
            expect(engine.listFlows()).toHaveLength(2);
        });

        it('dynamic next (branching)', async () => {
            const branchFlow = {
                name: 'branch',
                initialStep: 'choice',
                steps: [
                    { id: 'choice', prompt: 'a or b?', next: (val) => val === 'a' ? 'path_a' : 'path_b' },
                    { id: 'path_a', prompt: 'You chose A!', next: null },
                    { id: 'path_b', prompt: 'You chose B!', next: null },
                ],
            };
            const instance = await engine.start(branchFlow, 's1');
            const result = await engine.processInput('s1', instance.id, 'b');
            expect(result.prompt).toBe('You chose B!');
        });
    });

    // ─── Flow Registry ─────────────────────────────────────────

    describe('FlowRegistry', () => {
        it('has built-in onboarding flow', () => {
            const def = getFlowDef('onboarding');
            expect(def).toBeDefined();
            expect(def!.initialStep).toBe('welcome');
        });

        it('has built-in feedback flow', () => {
            const def = getFlowDef('feedback');
            expect(def).toBeDefined();
            expect(def!.steps.length).toBeGreaterThanOrEqual(3);
        });

        it('listFlows returns all registered', () => {
            const flows = listFlows();
            expect(flows.length).toBeGreaterThanOrEqual(2);
            expect(flows.map(f => f.name)).toContain('onboarding');
        });

        it('onboarding flow has validation', () => {
            const modelStep = onboardingFlow.steps.find(s => s.id === 'model');
            expect(modelStep!.validator!('1').valid).toBe(true);
            expect(modelStep!.validator!('9').valid).toBe(false);
        });

        it('feedback flow has transform', () => {
            const ratingStep = feedbackFlow.steps.find(s => s.id === 'rating');
            expect(ratingStep!.transform!('4')).toBe(4);
        });
    });
});
