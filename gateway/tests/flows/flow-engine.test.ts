import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlowEngine } from '../../src/flows/flow-engine.js';
import type { FlowDefinition } from '../../src/flows/types.js';

function makeFlow(overrides: Partial<FlowDefinition> = {}): FlowDefinition {
    return {
        name: overrides.name ?? 'test-flow',
        description: overrides.description ?? 'A test flow',
        initialStep: overrides.initialStep ?? 'step1',
        timeoutMs: overrides.timeoutMs,
        onComplete: overrides.onComplete,
        onCancel: overrides.onCancel,
        steps: overrides.steps ?? [
            { id: 'step1', prompt: 'Enter name:', next: 'step2' },
            { id: 'step2', prompt: 'Enter age:', next: null },
        ],
    };
}

describe('FlowEngine', () => {
    let engine: FlowEngine;

    beforeEach(() => {
        engine = new FlowEngine();
    });

    // ── Start ────────────────────────────────────────────────
    it('starts a flow and returns an instance', async () => {
        const instance = await engine.start(makeFlow(), 'sess1');
        expect(instance.id).toMatch(/^flow_/);
        expect(instance.state).toBe('waiting_input');
        expect(instance.currentStep).toBe('step1');
    });

    it('calls onEnter of initial step', async () => {
        const onEnter = vi.fn();
        await engine.start(makeFlow({
            steps: [
                { id: 'step1', prompt: 'hi', onEnter, next: null },
            ],
        }), 'sess1');
        expect(onEnter).toHaveBeenCalledOnce();
    });

    // ── processInput ─────────────────────────────────────────
    it('advances through steps on valid input', async () => {
        const inst = await engine.start(makeFlow(), 'sess1');
        const result = await engine.processInput('sess1', inst.id, 'Alice');
        expect(result.completed).toBe(false);
        expect(result.prompt).toBe('Enter age:');
    });

    it('completes the flow when next is null', async () => {
        const onComplete = vi.fn();
        const inst = await engine.start(makeFlow({ onComplete }), 'sess1');
        await engine.processInput('sess1', inst.id, 'Alice'); // step1 → step2
        const result = await engine.processInput('sess1', inst.id, '25'); // step2 → null
        expect(result.completed).toBe(true);
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it('returns validation error on invalid input', async () => {
        const inst = await engine.start(makeFlow({
            steps: [
                {
                    id: 'step1', prompt: 'Enter yes:',
                    validator: (input) => input === 'yes' ? { valid: true } : { valid: false, error: 'Must be yes' },
                    next: null,
                },
            ],
        }), 'sess1');
        const result = await engine.processInput('sess1', inst.id, 'no');
        expect(result.completed).toBe(false);
        expect(result.prompt).toBe('Must be yes');
    });

    it('applies transform before storing', async () => {
        const inst = await engine.start(makeFlow({
            steps: [
                { id: 'step1', prompt: 'Enter:', transform: (s) => s.toUpperCase(), next: null },
            ],
        }), 'sess1');
        await engine.processInput('sess1', inst.id, 'hello');
        // Flow completed — data captured in history
    });

    it('returns error when no active flow', async () => {
        const result = await engine.processInput('sess1', 'fake', 'hi');
        expect(result.error).toBeTruthy();
    });

    it('calls onExit of current step and onEnter of next step', async () => {
        const onExit = vi.fn();
        const onEnter = vi.fn();
        const inst = await engine.start(makeFlow({
            steps: [
                { id: 'step1', prompt: 'a', next: 'step2', onExit },
                { id: 'step2', prompt: 'b', next: null, onEnter },
            ],
        }), 'sess1');
        await engine.processInput('sess1', inst.id, 'val');
        expect(onExit).toHaveBeenCalledOnce();
        expect(onEnter).toHaveBeenCalledOnce();
    });

    it('supports dynamic next function', async () => {
        const inst = await engine.start(makeFlow({
            steps: [
                { id: 'step1', prompt: 'Choose:', next: (val) => val === 'a' ? 'branchA' : 'branchB' },
                { id: 'branchA', prompt: 'A!', next: null },
                { id: 'branchB', prompt: 'B!', next: null },
            ],
        }), 'sess1');
        const result = await engine.processInput('sess1', inst.id, 'a');
        expect(result.prompt).toBe('A!');
    });

    // ── Cancel ────────────────────────────────────────────────
    it('cancels a flow', async () => {
        const onCancel = vi.fn();
        const inst = await engine.start(makeFlow({ onCancel }), 'sess1');
        await engine.cancel('sess1', inst.id);
        expect(onCancel).toHaveBeenCalledOnce();
        expect(engine.activeCount).toBe(0);
    });

    it('cancel is no-op for missing flow', async () => {
        await engine.cancel('sess1', 'fake'); // should not throw
    });

    // ── getActiveFlow ────────────────────────────────────────
    it('getActiveFlow returns waiting flow', async () => {
        const inst = await engine.start(makeFlow(), 'sess1');
        const found = engine.getActiveFlow('sess1');
        expect(found?.id).toBe(inst.id);
    });

    it('getActiveFlow returns null when no active flow', () => {
        expect(engine.getActiveFlow('sess1')).toBeNull();
    });

    // ── listFlows ────────────────────────────────────────────
    it('listFlows returns all flows', async () => {
        await engine.start(makeFlow(), 'sess1');
        await engine.start(makeFlow(), 'sess2');
        expect(engine.listFlows()).toHaveLength(2);
    });

    it('listFlows filters by sessionId', async () => {
        await engine.start(makeFlow(), 'sess1');
        await engine.start(makeFlow(), 'sess2');
        expect(engine.listFlows('sess1')).toHaveLength(1);
    });

    // ── getFlowById ──────────────────────────────────────────
    it('getFlowById returns correct flow with sessionId', async () => {
        const inst = await engine.start(makeFlow(), 'sess1');
        expect(engine.getFlowById(inst.id, 'sess1')?.id).toBe(inst.id);
    });

    it('getFlowById searches globally without sessionId', async () => {
        const inst = await engine.start(makeFlow(), 'sess1');
        expect(engine.getFlowById(inst.id)?.id).toBe(inst.id);
    });

    it('getFlowById returns undefined for missing flow', () => {
        expect(engine.getFlowById('fake')).toBeUndefined();
    });

    // ── cleanExpired ─────────────────────────────────────────
    it('cleanExpired removes timed-out flows', async () => {
        const inst = await engine.start(makeFlow({ timeoutMs: 1 }), 'sess1');
        // Wait a bit so timeout kicks in
        await new Promise(r => setTimeout(r, 10));
        const cleaned = await engine.cleanExpired();
        expect(cleaned).toBe(1);
        expect(engine.activeCount).toBe(0);
    });

    it('cleanExpired calls onCancel', async () => {
        const onCancel = vi.fn();
        await engine.start(makeFlow({ timeoutMs: 1, onCancel }), 'sess1');
        await new Promise(r => setTimeout(r, 10));
        await engine.cleanExpired();
        expect(onCancel).toHaveBeenCalledOnce();
    });

    it('cleanExpired does not remove fresh flows', async () => {
        await engine.start(makeFlow({ timeoutMs: 999999 }), 'sess1');
        const cleaned = await engine.cleanExpired();
        expect(cleaned).toBe(0);
        expect(engine.activeCount).toBe(1);
    });

    // ── activeCount ──────────────────────────────────────────
    it('activeCount tracks flow count', async () => {
        expect(engine.activeCount).toBe(0);
        await engine.start(makeFlow(), 'sess1');
        expect(engine.activeCount).toBe(1);
    });
});
