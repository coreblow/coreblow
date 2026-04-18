/**
 * CoreBlow Phase 29 — Workflow Orchestration Chain Integration Tests
 *
 * Layer 2 (Pipeline Orchestration):
 *   StateMachine → WorkflowEngine → HooksEngine → FlowEngine
 *
 * Tests CoreBlow's exclusive Turn Engine pattern — chaining state
 * transitions with workflow execution, hook events, and interactive
 * flows. This is the key differentiator from CoreBlow's procedural
 * dispatch pipeline.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { StateMachine } from '../../src/infra/state-machine.js';
import { WorkflowEngine } from '../../src/infra/workflow-engine.js';
import { HooksEngine } from '../../src/hooks/engine.js';
import { FlowEngine } from '../../src/flows/flow-engine.js';
import { EventStore } from '../../src/infra/event-sourcing.js';
import type { FlowDefinition } from '../../src/flows/types.js';

describe('Phase29 Chain: Workflow Orchestration Pipeline', () => {
    let sm: StateMachine;
    let workflow: WorkflowEngine;
    let hooks: HooksEngine;
    let flows: FlowEngine;
    let audit: EventStore;

    beforeEach(() => {
        sm = new StateMachine();
        workflow = new WorkflowEngine();
        hooks = new HooksEngine();
        flows = new FlowEngine();
        audit = new EventStore();

        // Define a standard agent lifecycle state machine
        sm.define({
            id: 'agent-lifecycle',
            initialState: 'idle',
            states: ['idle', 'active', 'waiting_input', 'processing', 'completed', 'cancelled'],
            transitions: [
                { from: 'idle', to: 'active', event: 'start' },
                { from: 'active', to: 'waiting_input', event: 'need_input' },
                { from: 'waiting_input', to: 'processing', event: 'input_received' },
                { from: 'processing', to: 'completed', event: 'finish' },
                { from: 'processing', to: 'waiting_input', event: 'need_more_input' },
                { from: 'active', to: 'completed', event: 'finish' },
                { from: 'waiting_input', to: 'cancelled', event: 'timeout' },
                { from: 'active', to: 'cancelled', event: 'cancel' },
            ],
        });
    });

    // ── State-Driven Workflow ──

    it('StateMachine drives WorkflowEngine step execution', async () => {
        const instance = sm.create('agent-lifecycle')!;
        const executedSteps: string[] = [];

        // Register a workflow whose steps map to state transitions
        workflow.register({
            id: 'onboarding',
            name: 'User Onboarding',
            steps: [
                {
                    id: 'activate',
                    name: 'Activate Agent',
                    handler: async () => {
                        const result = sm.send(instance.id, 'start');
                        executedSteps.push('activate');
                        return result;
                    },
                },
                {
                    id: 'gather-info',
                    name: 'Gather User Info',
                    handler: async () => {
                        const result = sm.send(instance.id, 'need_input');
                        executedSteps.push('gather-info');
                        return result;
                    },
                },
            ],
        });

        const result = await workflow.execute('onboarding');
        expect(result.status).toBe('completed');
        expect(result.stepsExecuted).toBe(2);
        expect(executedSteps).toEqual(['activate', 'gather-info']);
        expect(sm.getState(instance.id)).toBe('waiting_input');
    });

    it('WorkflowEngine step completes → HooksEngine emits → FlowEngine starts dialog', async () => {
        const flowLog: string[] = [];

        // Define a greeting flow
        const greetingFlow: FlowDefinition = {
            name: 'greeting',
            description: 'Greet user',
            initialStep: 'ask-name',
            steps: [
                { id: 'ask-name', prompt: 'What is your name?', next: null },
            ],
        };

        // Hook: on workflow:step-completed, start a flow
        hooks.register({
            id: 'flow-trigger',
            name: 'flow-trigger',
            source: 'bundled',
            metadata: { events: ['workflow:step-completed'] },
            handler: async (ctx) => {
                const stepId = ctx.payload.stepId as string;
                if (stepId === 'greet') {
                    const inst = await flows.start(greetingFlow, 'session-1');
                    flowLog.push(`flow-started:${inst.id}`);
                }
            },
            enabled: true,
        });

        // Workflow step that emits hook event on completion
        workflow.register({
            id: 'welcome',
            name: 'Welcome Pipeline',
            steps: [
                {
                    id: 'greet',
                    name: 'Greet Step',
                    handler: async () => {
                        await hooks.emit('workflow:step-completed', { stepId: 'greet' });
                        return 'greeted';
                    },
                },
            ],
        });

        const result = await workflow.execute('welcome');
        expect(result.status).toBe('completed');
        expect(flowLog).toHaveLength(1);
        expect(flowLog[0]).toMatch(/^flow-started:/);
        expect(flows.activeCount).toBe(1);
        expect(flows.getActiveFlow('session-1')).not.toBeNull();
    });

    it('StateMachine guard failure → WorkflowEngine step skips → error recorded', async () => {
        // Define a guarded state machine
        sm.define({
            id: 'guarded-process',
            initialState: 'pending',
            states: ['pending', 'approved', 'denied'],
            transitions: [
                { from: 'pending', to: 'approved', event: 'approve', guard: (ctx) => ctx.role === 'admin' },
                { from: 'pending', to: 'denied', event: 'deny' },
            ],
        });

        const inst = sm.create('guarded-process', { role: 'viewer' })!;

        workflow.register({
            id: 'approval-flow',
            name: 'Approval',
            steps: [
                {
                    id: 'try-approve',
                    name: 'Try Approve',
                    handler: async () => {
                        const result = sm.send(inst.id, 'approve');
                        if (!result.success) {
                            throw new Error(`Guard failed: ${result.error}`);
                        }
                        return result;
                    },
                    onError: 'skip', // Skip on guard failure
                },
                {
                    id: 'fallback-deny',
                    name: 'Fallback Deny',
                    handler: async () => {
                        sm.send(inst.id, 'deny');
                        return 'denied';
                    },
                },
            ],
        });

        const result = await workflow.execute('approval-flow');
        expect(result.status).toBe('partial'); // First step errored
        expect(result.stepsExecuted).toBe(1); // Only fallback executed
        expect(result.stepsSkipped).toBe(1); // Guard-failure step skipped
        expect(sm.getState(inst.id)).toBe('denied');
    });

    // ── Full Agent Lifecycle ──

    it('complete lifecycle: idle → active → waiting → processing → completed', async () => {
        const instance = sm.create('agent-lifecycle')!;
        const timeline: string[] = [];

        workflow.register({
            id: 'full-lifecycle',
            name: 'Full Agent Lifecycle',
            steps: [
                {
                    id: 'boot',
                    name: 'Boot',
                    handler: async () => {
                        sm.send(instance.id, 'start');
                        timeline.push(`boot:${sm.getState(instance.id)}`);
                        audit.append('lifecycle:boot', 'agent-1', { state: sm.getState(instance.id) });
                    },
                },
                {
                    id: 'await-input',
                    name: 'Await Input',
                    handler: async () => {
                        sm.send(instance.id, 'need_input');
                        timeline.push(`await:${sm.getState(instance.id)}`);
                        audit.append('lifecycle:await', 'agent-1', { state: sm.getState(instance.id) });
                    },
                },
                {
                    id: 'process',
                    name: 'Process',
                    handler: async () => {
                        sm.send(instance.id, 'input_received');
                        timeline.push(`process:${sm.getState(instance.id)}`);
                        audit.append('lifecycle:process', 'agent-1', { state: sm.getState(instance.id) });
                    },
                },
                {
                    id: 'complete',
                    name: 'Complete',
                    handler: async () => {
                        sm.send(instance.id, 'finish');
                        timeline.push(`complete:${sm.getState(instance.id)}`);
                        audit.append('lifecycle:complete', 'agent-1', { state: sm.getState(instance.id) });
                    },
                },
            ],
        });

        const result = await workflow.execute('full-lifecycle');
        expect(result.status).toBe('completed');
        expect(result.stepsExecuted).toBe(4);
        expect(timeline).toEqual([
            'boot:active',
            'await:waiting_input',
            'process:processing',
            'complete:completed',
        ]);

        // Verify full audit trail
        expect(audit.getEvents('agent-1')).toHaveLength(4);
        expect(audit.getVersion('agent-1')).toBe(4);
    });

    it('StateMachine → WorkflowEngine → HooksEngine → FlowEngine full chain', async () => {
        const instance = sm.create('agent-lifecycle')!;
        const chainLog: string[] = [];

        // Hook: when agent enters 'waiting_input', start a flow
        hooks.register({
            id: 'input-flow-trigger',
            name: 'input-flow-trigger',
            source: 'bundled',
            metadata: { events: ['agent:state-changed'] },
            handler: async (ctx) => {
                if (ctx.payload.newState === 'waiting_input') {
                    const flowDef: FlowDefinition = {
                        name: 'user-prompt',
                        description: 'Get user input',
                        initialStep: 'prompt',
                        steps: [{ id: 'prompt', prompt: 'Please provide input:', next: null }],
                    };
                    await flows.start(flowDef, 'chain-session');
                    chainLog.push('flow-started');
                }
            },
            enabled: true,
        });

        // Workflow step that transitions state and emits hook
        workflow.register({
            id: 'chain-test',
            name: 'Chain Test',
            steps: [
                {
                    id: 'activate',
                    name: 'Activate',
                    handler: async () => {
                        sm.send(instance.id, 'start');
                        chainLog.push('sm:active');
                    },
                },
                {
                    id: 'request-input',
                    name: 'Request Input',
                    handler: async () => {
                        sm.send(instance.id, 'need_input');
                        await hooks.emit('agent:state-changed', { newState: 'waiting_input' });
                        chainLog.push('sm:waiting_input');
                    },
                },
            ],
        });

        const result = await workflow.execute('chain-test');

        expect(result.status).toBe('completed');
        expect(chainLog).toEqual(['sm:active', 'flow-started', 'sm:waiting_input']);
        expect(flows.activeCount).toBe(1);
        expect(sm.getState(instance.id)).toBe('waiting_input');

        // Complete the flow
        const activeFlow = flows.getActiveFlow('chain-session')!;
        const flowResult = await flows.processInput('chain-session', activeFlow.id, 'user answer');
        expect(flowResult.completed).toBe(true);
    });

    it('timeout: FlowEngine expires → HooksEngine notified → StateMachine cancels', async () => {
        const instance = sm.create('agent-lifecycle')!;
        sm.send(instance.id, 'start');
        sm.send(instance.id, 'need_input');
        expect(sm.getState(instance.id)).toBe('waiting_input');

        // Start a flow with very short timeout
        const flowDef: FlowDefinition = {
            name: 'short-lived',
            description: 'Expires quickly',
            initialStep: 's1',
            timeoutMs: 1,
            steps: [{ id: 's1', prompt: 'Quick!', next: null }],
        };

        await flows.start(flowDef, 'timeout-test');

        // Hook: on flow timeout, cancel the state machine
        hooks.register({
            id: 'timeout-handler',
            name: 'timeout-handler',
            source: 'bundled',
            metadata: { events: ['flow:expired'] },
            handler: async () => {
                sm.send(instance.id, 'timeout');
                audit.append('agent:cancelled', 'lifecycle', { reason: 'flow-timeout' });
            },
            enabled: true,
        });

        // Wait for expiry and clean
        await new Promise(r => setTimeout(r, 15));
        const cleaned = await flows.cleanExpired();
        expect(cleaned).toBe(1);

        // Fire the expiry hook
        await hooks.emit('flow:expired', { sessionId: 'timeout-test' });

        // Verify state machine transitioned to cancelled
        expect(sm.getState(instance.id)).toBe('cancelled');
        expect(audit.getByType('agent:cancelled')).toHaveLength(1);
    });
});
