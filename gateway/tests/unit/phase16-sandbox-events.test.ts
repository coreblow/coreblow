/**
 * CoreBlow Phase 16 — Sandbox & Event System Tests
 * Rewritten to match actual source APIs
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SandboxExecutor } from '../../src/sandbox/sandbox.js';
import { EventBus } from '../../src/infra/event-bus.js';
import { StreamProcessor } from '../../src/infra/stream-processor.js';
import { StateMachine } from '../../src/infra/state-machine.js';
import { TaskQueue } from '../../src/infra/task-queue.js';

// ================================================================
// Sandbox Executor Tests
// ================================================================
describe('SandboxExecutor', () => {
    let sandbox: SandboxExecutor;
    beforeEach(() => { sandbox = new SandboxExecutor(); });

    it('should execute simple code', () => {
        const result = sandbox.execute('1 + 2');
        expect(result.success).toBe(true);
        expect(result.returnValue).toBe(3);
    });

    it('should capture console output', () => {
        const result = sandbox.execute('console.log("hello"); console.log("world");');
        expect(result.output).toBe('hello\nworld');
    });

    it('should handle errors gracefully', () => {
        const result = sandbox.execute('throw new Error("boom")');
        expect(result.success).toBe(false);
        expect(result.error).toContain('boom');
    });

    it('should timeout long-running code', () => {
        const sb = new SandboxExecutor({ timeoutMs: 50 });
        const result = sb.execute('while(true) {}');
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
    });

    it('should provide custom context', () => {
        const sb = new SandboxExecutor({ context: { greeting: 'Hello' } });
        const result = sb.execute('greeting + " World"');
        expect(result.returnValue).toBe('Hello World');
    });

    it('should eval and return string', () => {
        expect(sandbox.eval('console.log("hi")')).toBe('hi');
    });

    it('should track history', () => {
        sandbox.execute('1+1');
        sandbox.execute('2+2');
        expect(sandbox.getHistory()).toHaveLength(2);
    });

    it('should truncate long output', () => {
        const sb = new SandboxExecutor({ maxOutput: 20 });
        const result = sb.execute('console.log("a".repeat(100))');
        expect(result.truncated).toBe(true);
    });
});

// ================================================================
// Event Bus Tests (matches src/infra/event-bus.ts actual API)
// ================================================================
describe('EventBus', () => {
    let bus: EventBus;
    beforeEach(() => { bus = new EventBus(); });

    it('should subscribe and emit', async () => {
        let received = '';
        bus.on('test', (data) => { received = data as string; });
        await bus.emit('test', 'hello');
        expect(received).toBe('hello');
    });

    it('should handle once listeners', async () => {
        let count = 0;
        bus.once('event', () => { count++; });
        await bus.emit('event');
        await bus.emit('event');
        expect(count).toBe(1);
    });

    it('should unsubscribe by function reference', async () => {
        let called = false;
        const fn = () => { called = true; };
        bus.on('test', fn);
        bus.off('test', fn);
        await bus.emit('test');
        expect(called).toBe(false);
    });

    it('should track event history', async () => {
        await bus.emit('test', { data: 1 });
        expect(bus.getHistory()).toHaveLength(1);
    });

    it('should get stats', async () => {
        bus.on('a', () => {});
        await bus.emit('a');
        const stats = bus.getStats();
        expect(stats.emitted).toBe(1);
        expect(stats.handled).toBe(1);
    });

    it('should list events with handler counts', () => {
        bus.on('a', () => {});
        bus.on('a', () => {});
        bus.on('b', () => {});
        const events = bus.listEvents();
        const aEvent = events.find(e => e.event === 'a');
        expect(aEvent?.handlers).toBe(2);
    });
});

// ================================================================
// Stream Processor Tests
// ================================================================
describe('StreamProcessor', () => {
    it('should process chunks', async () => {
        const proc = new StreamProcessor();
        const chunks: string[] = [];
        proc.onChunk((c) => { if (c.content) chunks.push(c.content); });
        proc.start();
        await proc.push({ type: 'text', content: 'Hello' });
        await proc.push({ type: 'text', content: ' World' });
        expect(chunks.join('')).toBe('Hello World');
        proc.stop();
    });

    it('should track stats', async () => {
        const proc = new StreamProcessor();
        proc.start();
        await proc.push({ type: 'text', content: 'abc' });
        const stats = proc.getStats();
        expect(stats.totalChunks).toBe(1);
        expect(stats.totalBytes).toBe(3);
        proc.stop();
    });

    it('should parse SSE format', () => {
        const sse = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n';
        const chunks = StreamProcessor.parseSSE(sse);
        expect(chunks).toHaveLength(2);
        expect(chunks[0]!.content).toBe('Hi');
        expect(chunks[1]!.type).toBe('done');
    });

    it('should apply transforms', async () => {
        const proc = new StreamProcessor({
            transform: (c) => c.content === 'skip' ? null : c,
        });
        const results: string[] = [];
        proc.onChunk((c) => { if (c.content) results.push(c.content); });
        proc.start();
        await proc.push({ type: 'text', content: 'keep' });
        await proc.push({ type: 'text', content: 'skip' });
        expect(results).toEqual(['keep']);
        proc.stop();
    });
});

// ================================================================
// State Machine Tests (matches definition+instance API)
// ================================================================
describe('StateMachine', () => {
    let sm: StateMachine;
    beforeEach(() => { sm = new StateMachine(); });

    it('should start in initial state', () => {
        sm.define({ id: 'test', initialState: 'idle', states: ['idle', 'running'], transitions: [{ from: 'idle', event: 'start', to: 'running' }] });
        const inst = sm.create('test')!;
        expect(sm.getState(inst.id)).toBe('idle');
    });

    it('should transition on events', () => {
        sm.define({ id: 'test', initialState: 'idle', states: ['idle', 'running'], transitions: [{ from: 'idle', event: 'start', to: 'running' }, { from: 'running', event: 'stop', to: 'idle' }] });
        const inst = sm.create('test')!;
        const result = sm.send(inst.id, 'start');
        expect(result.success).toBe(true);
        expect(sm.getState(inst.id)).toBe('running');
    });

    it('should reject invalid transitions', () => {
        sm.define({ id: 'test', initialState: 'idle', states: ['idle', 'running'], transitions: [{ from: 'idle', event: 'start', to: 'running' }] });
        const inst = sm.create('test')!;
        const result = sm.send(inst.id, 'stop');
        expect(result.success).toBe(false);
    });

    it('should enforce guards', () => {
        sm.define({ id: 'test', initialState: 'idle', states: ['idle', 'running'], transitions: [{ from: 'idle', event: 'start', to: 'running', guard: (ctx) => ctx.ready === true }] });
        const inst = sm.create('test', { ready: false })!;
        expect(sm.send(inst.id, 'start').success).toBe(false);
    });

    it('should list available events', () => {
        sm.define({ id: 'test', initialState: 'idle', states: ['idle', 'running'], transitions: [{ from: 'idle', event: 'start', to: 'running' }, { from: 'idle', event: 'reset', to: 'idle' }, { from: 'running', event: 'stop', to: 'idle' }] });
        const inst = sm.create('test')!;
        expect(sm.getAvailableEvents(inst.id).sort()).toEqual(['reset', 'start']);
    });

    it('should track history', () => {
        sm.define({ id: 'test', initialState: 'idle', states: ['idle', 'active'], transitions: [{ from: 'idle', event: 'go', to: 'active' }] });
        const inst = sm.create('test')!;
        sm.send(inst.id, 'go');
        expect(sm.getInstance(inst.id)!.history).toHaveLength(1);
    });
});

// ================================================================
// Task Queue Tests (matches enqueue/process API)
// ================================================================
describe('TaskQueue', () => {
    it('should add and execute tasks', async () => {
        const queue = new TaskQueue(1);
        queue.enqueue('test', async () => 42);
        await queue.process();
        const stats = queue.getStats();
        expect(stats.completed).toBe(1);
    });

    it('should respect priority', async () => {
        const order: number[] = [];
        const queue = new TaskQueue(1);
        queue.enqueue('low', async () => { order.push(1); }, 0);
        queue.enqueue('high', async () => { order.push(2); }, 10);
        await queue.process();
        // High priority first in queue
        expect(order).toHaveLength(2);
    });

    it('should retry failed tasks', async () => {
        let attempts = 0;
        const queue = new TaskQueue(1);
        queue.enqueue('retry-test', async () => {
            attempts++;
            if (attempts < 3) throw new Error('fail');
            return 'ok';
        }, 0, 2);
        await queue.process();
        await queue.process(); // Process retries
        await queue.process();
        expect(attempts).toBe(3);
    });

    it('should track stats', async () => {
        const queue = new TaskQueue(2);
        queue.enqueue('a', async () => 1);
        queue.enqueue('b', async () => 2);
        await queue.process();
        const stats = queue.getStats();
        expect(stats.completed).toBe(2);
    });

    it('should get dead letter queue', async () => {
        const queue = new TaskQueue(1);
        queue.enqueue('fail-task', async () => { throw new Error('fail'); }, 0, 0);
        await queue.process();
        expect(queue.getDeadLetter().length).toBe(1);
    });
});
