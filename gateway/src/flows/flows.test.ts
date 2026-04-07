/**
 * Conversation flow engine tests
 */
import { describe, it, expect } from 'vitest';
import { FlowEngine } from './flow-engine.js';
import { onboardingFlow, feedbackFlow, registerFlow, getFlowDef, listFlows } from './flow-registry.js';

describe('FlowEngine', () => {
    it('should start a flow', async () => {
        const engine = new FlowEngine();
        const instance = await engine.start(onboardingFlow, 'sess1');
        expect(instance.state).toBe('waiting_input');
        expect(instance.currentStep).toBe('welcome');
    });

    it('should process input and advance', async () => {
        const engine = new FlowEngine();
        const instance = await engine.start(onboardingFlow, 'sess2');

        // Answer welcome step
        const result = await engine.processInput('sess2', instance.id, 'Test User');
        expect(result.completed).toBe(false);
        expect(result.prompt).toContain('model');
    });

    it('should validate input', async () => {
        const engine = new FlowEngine();
        const instance = await engine.start(onboardingFlow, 'sess3');

        // Skip welcome
        await engine.processInput('sess3', instance.id, 'User');

        // Invalid model choice
        const result = await engine.processInput('sess3', instance.id, '9');
        expect(result.completed).toBe(false);
        expect(result.error ?? result.prompt).toContain('1, 2, or 3');
    });

    it('should complete a flow', async () => {
        const engine = new FlowEngine();
        const instance = await engine.start(feedbackFlow, 'sess4');

        await engine.processInput('sess4', instance.id, '5');
        await engine.processInput('sess4', instance.id, 'Great service!');
        const result = await engine.processInput('sess4', instance.id, 'done');
        // After 'thanks' step (no next), flow completes
        expect(result.completed).toBe(true);
    });

    it('should cancel a flow', async () => {
        const engine = new FlowEngine();
        const instance = await engine.start(onboardingFlow, 'sess5');
        await engine.cancel('sess5', instance.id);
        expect(engine.getActiveFlow('sess5')).toBeNull();
    });

    it('should track active flows', async () => {
        const engine = new FlowEngine();
        await engine.start(onboardingFlow, 'sess6');
        expect(engine.activeCount).toBe(1);
        expect(engine.getActiveFlow('sess6')).toBeTruthy();
    });
});

describe('FlowRegistry', () => {
    it('should have built-in flows registered', () => {
        expect(getFlowDef('onboarding')).toBeTruthy();
        expect(getFlowDef('feedback')).toBeTruthy();
    });

    it('should list all flows', () => {
        expect(listFlows().length).toBeGreaterThanOrEqual(2);
    });

    it('should register custom flows', () => {
        registerFlow({
            name: 'custom-test',
            description: 'Test flow',
            initialStep: 'q1',
            steps: [{ id: 'q1', prompt: 'Question?' }],
        });
        expect(getFlowDef('custom-test')).toBeTruthy();
    });
});
