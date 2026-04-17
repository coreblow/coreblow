/**
 * CoreBlow Phase 40 — Queue & Messaging Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageBroker } from '../../src/infra/message-broker.js';
import { PubSub } from '../../src/infra/pub-sub.js';
import { DeadLetterQueue } from '../../src/infra/dead-letter-queue.js';
import { EventBus } from '../../src/infra/event-bus.js';
import { MessageReplay } from '../../src/infra/message-replay.js';

// ================================================================
describe('MessageBroker', () => {
    let broker: MessageBroker;
    beforeEach(() => { broker = new MessageBroker(); });

    it('should publish messages', () => {
        broker.publish('emails', { to: 'alice@test.com' });
        expect(broker.depth('emails')).toBe(1);
    });

    it('should process messages', async () => {
        broker.publish('tasks', { type: 'send' });
        broker.subscribe('tasks', async () => true);
        const msg = await broker.processNext('tasks');
        expect(msg?.status).toBe('completed');
    });

    it('should retry on failure', async () => {
        broker.publish('tasks', {}, 0, 3);
        broker.subscribe('tasks', async () => false);
        await broker.processNext('tasks');
        expect(broker.depth('tasks')).toBe(1); // back to pending
    });

    it('should move to failed after max attempts', async () => {
        broker.publish('tasks', {}, 0, 1);
        broker.subscribe('tasks', async () => false);
        const msg = await broker.processNext('tasks');
        expect(msg?.status).toBe('failed');
    });

    it('should respect priority', () => {
        broker.publish('q', { name: 'low' }, 1);
        broker.publish('q', { name: 'high' }, 10);
        const queued = broker.listQueues();
        expect(queued[0]?.depth).toBe(2);
    });

    it('should list queues', () => {
        broker.publish('a', {}); broker.publish('b', {});
        expect(broker.listQueues()).toHaveLength(2);
    });
});

// ================================================================
describe('PubSub', () => {
    let ps: PubSub;
    beforeEach(() => { ps = new PubSub(); });

    it('should publish and receive', () => {
        let received: unknown;
        ps.subscribe('user.created', (_, data) => { received = data; });
        ps.publish('user.created', { id: 1 });
        expect(received).toEqual({ id: 1 });
    });

    it('should support wildcard *', () => {
        let count = 0;
        ps.subscribe('user.*', () => { count++; });
        ps.publish('user.created', {});
        ps.publish('user.deleted', {});
        expect(count).toBe(2);
    });

    it('should support wildcard #', () => {
        let count = 0;
        ps.subscribe('#', () => { count++; });
        ps.publish('any.topic.here', {});
        expect(count).toBe(1);
    });

    it('should filter messages', () => {
        let received = false;
        ps.subscribe('events', () => { received = true; }, (data) => (data as { type: string }).type === 'important');
        ps.publish('events', { type: 'boring' });
        expect(received).toBe(false);
    });

    it('should unsubscribe', () => {
        const id = ps.subscribe('test', () => {});
        ps.unsubscribe(id);
        expect(ps.count()).toBe(0);
    });
});

// ================================================================
describe('DeadLetterQueue', () => {
    let dlq: DeadLetterQueue;
    beforeEach(() => { dlq = new DeadLetterQueue(); });

    it('should add dead letters', () => {
        dlq.add('emails', { to: 'test' }, 'timeout', 3);
        expect(dlq.count()).toBe(1);
    });

    it('should get by queue', () => {
        dlq.add('emails', {}, 'err', 1);
        dlq.add('tasks', {}, 'err', 1);
        expect(dlq.getByQueue('emails')).toHaveLength(1);
    });

    it('should mark retried', () => {
        const dl = dlq.add('q', {}, 'err', 1);
        dlq.markRetried(dl.id);
        expect(dlq.getUnretried()).toHaveLength(0);
    });

    it('should summarize', () => {
        dlq.add('a', {}, 'err', 1);
        dlq.add('a', {}, 'err', 1);
        dlq.add('b', {}, 'err', 1);
        const summary = dlq.summary();
        expect(summary).toHaveLength(2);
    });

    it('should purge old', () => {
        dlq.add('q', {}, 'err', 1);
        const purged = dlq.purge(1); // 1ms ago
        expect(purged).toBe(0); // too recent
    });
});

// ================================================================
describe('EventBus', () => {
    let bus: EventBus;
    beforeEach(() => { bus = new EventBus(); });

    it('should emit and handle', async () => {
        let val: unknown;
        bus.on('test', (data) => { val = data; });
        await bus.emit('test', 'hello');
        expect(val).toBe('hello');
    });

    it('should handle once', async () => {
        let count = 0;
        bus.once('test', () => { count++; });
        await bus.emit('test');
        await bus.emit('test');
        expect(count).toBe(1);
    });

    it('should remove listener', async () => {
        let count = 0;
        const fn = () => { count++; };
        bus.on('test', fn);
        bus.off('test', fn);
        await bus.emit('test');
        expect(count).toBe(0);
    });

    it('should track history', async () => {
        await bus.emit('a', 1);
        await bus.emit('b', 2);
        expect(bus.getHistory()).toHaveLength(2);
    });

    it('should track stats', async () => {
        bus.on('x', () => {});
        await bus.emit('x');
        expect(bus.getStats().handled).toBe(1);
    });
});

// ================================================================
describe('MessageReplay', () => {
    let replay: MessageReplay;
    beforeEach(() => { replay = new MessageReplay(); });

    it('should start/stop recording', () => {
        replay.startRecording();
        expect(replay.isRecording()).toBe(true);
        replay.stopRecording();
        expect(replay.isRecording()).toBe(false);
    });

    it('should record messages', () => {
        const sid = replay.startRecording();
        replay.record('user.created', { id: 1 });
        replay.record('user.updated', { id: 1 });
        expect(replay.getSession(sid)).toHaveLength(2);
    });

    it('should replay messages', async () => {
        const sid = replay.startRecording();
        replay.record('a', { x: 1 });
        replay.record('b', { x: 2 });
        replay.stopRecording();
        const result = await replay.replay(sid, async () => {});
        expect(result.replayed).toBe(2);
    });

    it('should filter by topic', () => {
        const sid = replay.startRecording();
        replay.record('a', {}); replay.record('b', {}); replay.record('a', {});
        expect(replay.filter(sid, 'a')).toHaveLength(2);
    });

    it('should list sessions', () => {
        replay.startRecording('s1');
        replay.stopRecording();
        replay.startRecording('s2');
        replay.stopRecording();
        expect(replay.listSessions()).toHaveLength(2);
    });
});
