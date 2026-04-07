/**
 * CoreBlow Phase 35 — ContributionRegistry & FlowRegistry Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - ContributionRegistry: register, unregister, getForFlow, merge, priority
 *   - FlowRegistry: registerFlow, getFlowDef, listFlows, built-in flows
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContributionRegistry } from '../../src/flows/contributions.js';
import { registerFlow, getFlowDef, listFlows } from '../../src/flows/flow-registry.js';

// ================================================================
describe('ContributionRegistry — Extended', () => {
    let reg: ContributionRegistry;
    beforeEach(() => { reg = new ContributionRegistry(); });

    it('should register and retrieve contributions for a flow', () => {
        reg.register({ id: 'c1', flowId: 'onboarding', priority: 1, content: { step: 'extra' } });
        reg.register({ id: 'c2', flowId: 'feedback', priority: 1, content: { step: 'rating' } });
        reg.register({ id: 'c3', flowId: 'onboarding', priority: 2, content: { step: 'verify' } });

        const onboarding = reg.getForFlow('onboarding');
        expect(onboarding).toHaveLength(2);
    });

    it('should sort by priority', () => {
        reg.register({ id: 'low', flowId: 'f1', priority: 10, content: 'low' });
        reg.register({ id: 'high', flowId: 'f1', priority: 1, content: 'high' });
        reg.register({ id: 'mid', flowId: 'f1', priority: 5, content: 'mid' });

        const items = reg.getForFlow('f1');
        expect(items[0]!.id).toBe('high');
        expect(items[1]!.id).toBe('mid');
        expect(items[2]!.id).toBe('low');
    });

    it('should unregister a contribution', () => {
        reg.register({ id: 'c1', flowId: 'f1', priority: 1, content: 'x' });
        expect(reg.unregister('c1')).toBe(true);
        expect(reg.getForFlow('f1')).toHaveLength(0);
    });

    it('should return false for unregistering non-existent', () => {
        expect(reg.unregister('ghost')).toBe(false);
    });

    it('should merge contributions with injectBefore', () => {
        reg.register({ id: 'injected', flowId: 'f1', priority: 1, injectBefore: 'step-b', content: { id: 'injected' } });

        const base = [{ id: 'step-a' }, { id: 'step-b' }, { id: 'step-c' }];
        const merged = reg.merge(base, (c) => c.content);

        expect(merged[0]!.id).toBe('step-a');
        expect(merged[1]!.id).toBe('injected');
        expect(merged[2]!.id).toBe('step-b');
    });

    it('should merge contributions with injectAfter', () => {
        reg.register({ id: 'injected', flowId: 'f1', priority: 1, injectAfter: 'step-a', content: { id: 'injected' } });

        const base = [{ id: 'step-a' }, { id: 'step-b' }];
        const merged = reg.merge(base, (c) => c.content);

        expect(merged[0]!.id).toBe('step-a');
        expect(merged[1]!.id).toBe('injected');
        expect(merged[2]!.id).toBe('step-b');
    });

    it('should append to end when anchor not found', () => {
        reg.register({ id: 'orphan', flowId: 'f1', priority: 1, injectBefore: 'nonexistent', content: { id: 'orphan' } });

        const base = [{ id: 'step-a' }];
        const merged = reg.merge(base, (c) => c.content);

        expect(merged).toHaveLength(2);
        expect(merged[1]!.id).toBe('orphan');
    });

    it('should clear all contributions', () => {
        reg.register({ id: 'c1', flowId: 'f1', priority: 1, content: 'x' });
        reg.register({ id: 'c2', flowId: 'f2', priority: 1, content: 'y' });
        reg.clear();
        expect(reg.getForFlow('f1')).toHaveLength(0);
        expect(reg.getForFlow('f2')).toHaveLength(0);
    });
});

// ================================================================
describe('FlowRegistry — Extended', () => {
    it('should have built-in onboarding flow', () => {
        const flow = getFlowDef('onboarding');
        expect(flow).toBeDefined();
        expect(flow?.initialStep).toBe('welcome');
        expect(flow?.steps.length).toBeGreaterThanOrEqual(3);
    });

    it('should have built-in feedback flow', () => {
        const flow = getFlowDef('feedback');
        expect(flow).toBeDefined();
        expect(flow?.initialStep).toBe('rating');
    });

    it('should list all registered flows', () => {
        const flows = listFlows();
        expect(flows.length).toBeGreaterThanOrEqual(2);
        const names = flows.map(f => f.name);
        expect(names).toContain('onboarding');
        expect(names).toContain('feedback');
    });

    it('should register and retrieve custom flow', () => {
        registerFlow({
            name: 'custom-test-flow', description: 'Test', initialStep: 'start',
            steps: [{ id: 'start', prompt: 'Hello' }],
        });
        expect(getFlowDef('custom-test-flow')).toBeDefined();
    });

    it('should return undefined for unknown flow', () => {
        expect(getFlowDef('nonexistent')).toBeUndefined();
    });

    it('should validate onboarding flow step validator', () => {
        const flow = getFlowDef('onboarding')!;
        const modelStep = flow.steps.find(s => s.id === 'model');
        expect(modelStep?.validator).toBeDefined();
        expect(modelStep!.validator!('1').valid).toBe(true);
        expect(modelStep!.validator!('99').valid).toBe(false);
    });
});
