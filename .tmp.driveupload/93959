/**
 * CoreBlow Phase 29 — Subsystem Health Validation Tests
 *
 * Layer 3 (System Health):
 *   - Boot sequence: all 14 subsystems instantiate without errors
 *   - Cross-wiring: subsystems can be connected and communicate
 *   - Telemetry: every subsystem reports accurate stats after operations
 */
import { describe, it, expect } from 'vitest';

// All 14 subsystem imports
import { WorkflowEngine } from '../../src/infra/workflow-engine.js';
import { TaskQueue } from '../../src/infra/task-queue.js';
import { EventStore } from '../../src/infra/event-sourcing.js';
import { StateMachine } from '../../src/infra/state-machine.js';
import { CircuitBreaker } from '../../src/infra/circuit-breaker.js';
import { RetryPolicy } from '../../src/infra/retry-policy.js';
import { DeadLetterQueue } from '../../src/infra/dead-letter-queue.js';
import { MessageBroker } from '../../src/infra/message-broker.js';
import { EventBus } from '../../src/infra/event-bus.js';
import { PubSub } from '../../src/infra/pub-sub.js';
import { StreamProcessor } from '../../src/infra/stream-processor.js';
import { HooksEngine } from '../../src/hooks/engine.js';
import { FlowEngine } from '../../src/flows/flow-engine.js';
import { HookBus } from '../../src/hooks/hook-bus.js';

// ================================================================
// Boot Sequence
// ================================================================
describe('Phase29 Health: Boot Sequence', () => {
    it('all 14 subsystems instantiate without errors', () => {
        // Infrastructure subsystems
        const workflow = new WorkflowEngine();
        const taskQueue = new TaskQueue(5);
        const eventStore = new EventStore();
        const stateMachine = new StateMachine();
        const circuitBreaker = new CircuitBreaker();
        const retryPolicy = new RetryPolicy();
        const dlq = new DeadLetterQueue();
        const messageBroker = new MessageBroker();
        const eventBus = new EventBus();
        const pubsub = new PubSub();
        const stream = new StreamProcessor();

        // Domain subsystems
        const hooks = new HooksEngine();
        const flows = new FlowEngine();
        const hookBus = new HookBus();

        // All should be in clean initial state
        expect(workflow.count()).toBe(0);
        expect(taskQueue.count()).toBe(0);
        expect(eventStore.count()).toBe(0);
        expect(stateMachine.count()).toBe(0);
        expect(circuitBreaker.count()).toBe(0);
        expect(dlq.count()).toBe(0);
        expect(pubsub.count()).toBe(0);
        expect(hooks.list()).toHaveLength(0);
        expect(flows.activeCount).toBe(0);
        expect(hookBus.keys()).toHaveLength(0);
        expect(eventBus.getStats().emitted).toBe(0);
        expect(messageBroker.getStats().published).toBe(0);
        expect(stream.getStats().totalChunks).toBe(0);
        expect(retryPolicy.getStats().totalCalls).toBe(0);
    });

    it('HooksEngine + FlowEngine + HookBus cross-wire (Phase 6 subsystems)', async () => {
        const hooks = new HooksEngine();
        const flows = new FlowEngine();
        const bus = new HookBus();
        const log: string[] = [];

        // Wire: HookBus → HooksEngine → FlowEngine
        bus.on('setup:start', async () => {
            await hooks.emit('flow:init', { trigger: 'setup' });
        });

        hooks.register({
            id: 'flow-starter',
            name: 'flow-starter',
            source: 'bundled',
            metadata: { events: ['flow:init'] },
            handler: async () => {
                const inst = await flows.start({
                    name: 'setup',
                    description: 'Setup flow',
                    initialStep: 's1',
                    steps: [{ id: 's1', prompt: 'Ready?', next: null }],
                }, 'health-session');
                log.push(`flow:${inst.id}`);
            },
            enabled: true,
        });

        await bus.fire('setup:start', {});

        expect(log).toHaveLength(1);
        expect(flows.activeCount).toBe(1);
    });

    it('WorkflowEngine + StateMachine + CircuitBreaker + TaskQueue cross-wire (Infra subsystems)', async () => {
        const workflow = new WorkflowEngine();
        const sm = new StateMachine();
        const cb = new CircuitBreaker();
        const queue = new TaskQueue(3);

        sm.define({
            id: 'boot',
            initialState: 'init',
            states: ['init', 'ready', 'running'],
            transitions: [
                { from: 'init', to: 'ready', event: 'configure' },
                { from: 'ready', to: 'running', event: 'start' },
            ],
        });

        const instance = sm.create('boot')!;

        workflow.register({
            id: 'boot-sequence',
            name: 'Boot',
            steps: [
                {
                    id: 'configure',
                    name: 'Configure',
                    handler: async () => {
                        await cb.execute('config-svc', async () => 'config-loaded');
                        sm.send(instance.id, 'configure');
                    },
                },
                {
                    id: 'start-tasks',
                    name: 'Start Tasks',
                    handler: async () => {
                        queue.enqueue('boot-task', async () => 'booted');
                        sm.send(instance.id, 'start');
                    },
                },
            ],
        });

        const result = await workflow.execute('boot-sequence');
        await queue.process();

        expect(result.status).toBe('completed');
        expect(sm.getState(instance.id)).toBe('running');
        expect(cb.getState('config-svc')).toBe('closed');
        expect(queue.getStats().completed).toBe(1);
    });
});

// ================================================================
// Telemetry Chain
// ================================================================
describe('Phase29 Health: Telemetry Chain', () => {
    it('every subsystem reports accurate stats after operations', async () => {
        // Initialize all subsystems
        const workflow = new WorkflowEngine();
        const queue = new TaskQueue(5);
        const events = new EventStore();
        const cb = new CircuitBreaker();
        const retry = new RetryPolicy({ baseDelayMs: 0, maxDelayMs: 0, jitter: false });
        const dlq = new DeadLetterQueue();
        const broker = new MessageBroker();
        const bus = new EventBus();
        const pubsub = new PubSub();

        // Execute operations across all subsystems
        workflow.register({
            id: 'w1', name: 'Test', steps: [
                { id: 's1', name: 'S1', handler: async () => 'done' },
            ],
        });
        await workflow.execute('w1');

        queue.enqueue('t1', async () => 'ok');
        await queue.process();

        events.append('test', 'agg-1', {});
        events.append('test', 'agg-1', {});

        await cb.execute('svc', async () => 'ok');

        await retry.execute(async () => 'ok');

        dlq.add('q1', {}, 'err', 1);

        broker.publish('mq', {});
        broker.subscribe('mq', async () => true);
        await broker.processNext('mq');

        bus.on('x', () => {});
        await bus.emit('x');

        pubsub.subscribe('topic', () => {});
        pubsub.publish('topic', {});

        // Verify all telemetry
        expect(workflow.getHistory()).toHaveLength(1);
        expect(workflow.getHistory()[0]!.status).toBe('completed');

        expect(queue.getStats().completed).toBe(1);
        expect(queue.getStats().pending).toBe(0);

        expect(events.count()).toBe(2);
        expect(events.getVersion('agg-1')).toBe(2);

        expect(cb.getStats('svc')!.successes).toBe(1);
        expect(cb.getStats('svc')!.failures).toBe(0);

        expect(retry.getStats().totalCalls).toBe(1);
        expect(retry.getStats().totalSuccess).toBe(1);

        expect(dlq.count()).toBe(1);

        expect(broker.getStats().published).toBe(1);
        expect(broker.getStats().consumed).toBe(1);

        expect(bus.getStats().emitted).toBe(1);
        expect(bus.getStats().handled).toBe(1);

        expect(pubsub.getStats().published).toBe(1);
        expect(pubsub.getStats().delivered).toBe(1);
    });

    it('EventStore captures audit trail from all subsystem operations', async () => {
        const events = new EventStore();
        const cb = new CircuitBreaker();
        const broker = new MessageBroker();
        const hooks = new HooksEngine();

        // Simulate a production-like audit trail
        events.append('system:boot', 'gateway', { version: '1.0.0' });

        await cb.execute('auth-svc', async () => {
            events.append('circuit:success', 'gateway', { service: 'auth-svc' });
            return 'authed';
        });

        broker.publish('notifications', { type: 'welcome' });
        broker.subscribe('notifications', async (msg) => {
            events.append('broker:consumed', 'gateway', { queue: msg.queue });
            return true;
        });
        await broker.processNext('notifications');

        hooks.register({
            id: 'audit-hook',
            name: 'audit',
            source: 'bundled',
            metadata: { events: ['system:*'] },
            handler: async (ctx) => {
                events.append('hook:triggered', 'gateway', { hookEvent: ctx.event });
            },
            enabled: true,
        });
        await hooks.emit('system:ping', {});

        // Full audit trail should be complete
        const trail = events.getEvents('gateway');
        expect(trail).toHaveLength(4);
        expect(trail.map(e => e.type)).toEqual([
            'system:boot',
            'circuit:success',
            'broker:consumed',
            'hook:triggered',
        ]);

        // Versions are sequential
        expect(trail.map(e => e.version)).toEqual([1, 2, 3, 4]);
    });

    it('StreamProcessor parses real-world OpenAI SSE stream correctly', () => {
        // Simulate a realistic multi-chunk SSE response
        const sseStream = [
            'data: {"id":"chatcmpl-abc","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
            '',
            'data: {"id":"chatcmpl-abc","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
            '',
            'data: {"id":"chatcmpl-abc","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}',
            '',
            'data: {"id":"chatcmpl-abc","choices":[{"index":0,"delta":{"content":" How"},"finish_reason":null}]}',
            '',
            'data: {"id":"chatcmpl-abc","choices":[{"index":0,"delta":{"content":" can"},"finish_reason":null}]}',
            '',
            'data: {"id":"chatcmpl-abc","choices":[{"index":0,"delta":{"content":" I help?"},"finish_reason":null}]}',
            '',
            'data: {"id":"chatcmpl-abc","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}',
            '',
            'data: [DONE]',
        ].join('\n');

        const chunks = StreamProcessor.parseSSE(sseStream);

        // Filter to just text chunks with content
        const textChunks = chunks.filter(c => c.type === 'text' && c.content);
        const fullMessage = textChunks.map(c => c.content).join('');

        expect(fullMessage).toBe('Hello! How can I help?');
        expect(chunks[chunks.length - 1]!.type).toBe('done');
    });
});
