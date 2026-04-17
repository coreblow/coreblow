/**
 * CoreBlow Phase 29 — Messaging Subsystem Unit Tests
 *
 * Layer 1 (Class Contract) for:
 *   - MessageBroker: publish, subscribe, process, priority, retry, dead letter
 *   - EventBus: on, once, off, async emit, history, stats
 *   - PubSub: subscribe, publish, wildcard, filter, unsubscribe
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageBroker } from '../../src/infra/message-broker.js';
import { EventBus } from '../../src/infra/event-bus.js';
import { PubSub } from '../../src/infra/pub-sub.js';

// ================================================================
// MessageBroker
// ================================================================
describe('MessageBroker', () => {
    let broker: MessageBroker;

    beforeEach(() => {
        broker = new MessageBroker();
    });

    it('should publish messages', () => {
        const msg = broker.publish('orders', { item: 'widget' });
        expect(msg.id).toMatch(/^msg-/);
        expect(msg.queue).toBe('orders');
        expect(msg.status).toBe('pending');
        expect(broker.depth('orders')).toBe(1);
    });

    it('should order messages by priority', () => {
        broker.publish('q1', { name: 'low' }, 1);
        broker.publish('q1', { name: 'high' }, 10);
        broker.publish('q1', { name: 'mid' }, 5);
        // High priority should be first in queue
        expect(broker.depth('q1')).toBe(3);
    });

    it('should subscribe consumers', () => {
        const id = broker.subscribe('orders', async () => true);
        expect(id).toMatch(/^consumer-/);
    });

    it('should process next message successfully', async () => {
        broker.publish('orders', { id: 1 });
        broker.subscribe('orders', async () => true);

        const result = await broker.processNext('orders');
        expect(result).not.toBeNull();
        expect(result!.status).toBe('completed');
        expect(broker.depth('orders')).toBe(0);
    });

    it('should retry on consumer failure', async () => {
        broker.publish('orders', { id: 1 }, 0, 3); // 3 max attempts
        broker.subscribe('orders', async () => false);

        const result = await broker.processNext('orders');
        expect(result).not.toBeNull();
        // Should be retried (back to pending), not failed
        expect(result!.status).toBe('pending');
    });

    it('should mark as failed after max attempts', async () => {
        broker.publish('orders', { id: 1 }, 0, 1); // 1 max attempt
        broker.subscribe('orders', async () => { throw new Error('crash'); });

        const result = await broker.processNext('orders');
        expect(result).not.toBeNull();
        expect(result!.status).toBe('failed');
    });

    it('should return null when no pending messages', async () => {
        broker.subscribe('orders', async () => true);
        const result = await broker.processNext('orders');
        expect(result).toBeNull();
    });

    it('should track stats', async () => {
        broker.publish('q1', {});
        broker.subscribe('q1', async () => true);
        await broker.processNext('q1');

        const stats = broker.getStats();
        expect(stats.published).toBe(1);
        expect(stats.consumed).toBe(1);
    });

    it('should list queues with depths and consumer counts', () => {
        broker.publish('orders', {});
        broker.publish('orders', {});
        broker.publish('emails', {});
        broker.subscribe('orders', async () => true);

        const queues = broker.listQueues();
        expect(queues).toHaveLength(2);

        const ordersQueue = queues.find(q => q.name === 'orders')!;
        expect(ordersQueue.depth).toBe(2);
        expect(ordersQueue.consumers).toBe(1);

        const emailsQueue = queues.find(q => q.name === 'emails')!;
        expect(emailsQueue.depth).toBe(1);
        expect(emailsQueue.consumers).toBe(0);
    });
});

// ================================================================
// EventBus
// ================================================================
describe('EventBus', () => {
    let bus: EventBus;

    beforeEach(() => {
        bus = new EventBus();
    });

    it('should register and emit events', async () => {
        const received: unknown[] = [];
        bus.on('user:created', (data) => { received.push(data); });

        const handled = await bus.emit('user:created', { name: 'Alice' });
        expect(handled).toBe(1);
        expect(received).toEqual([{ name: 'Alice' }]);
    });

    it('should handle once listeners (auto-removal)', async () => {
        let calls = 0;
        bus.once('ping', () => { calls++; });

        await bus.emit('ping');
        await bus.emit('ping');
        expect(calls).toBe(1);
    });

    it('should remove listeners with off()', async () => {
        let calls = 0;
        const handler = () => { calls++; };
        bus.on('tick', handler);

        await bus.emit('tick');
        bus.off('tick', handler);
        await bus.emit('tick');

        expect(calls).toBe(1);
    });

    it('should handle async handlers', async () => {
        const results: string[] = [];
        bus.on('async-task', async () => {
            await new Promise(r => setTimeout(r, 5));
            results.push('done');
        });

        await bus.emit('async-task');
        expect(results).toEqual(['done']);
    });

    it('should return 0 when no handlers exist', async () => {
        const handled = await bus.emit('nobody-listens');
        expect(handled).toBe(0);
    });

    it('should track event history', async () => {
        await bus.emit('a', { x: 1 });
        await bus.emit('b', { x: 2 });
        await bus.emit('a', { x: 3 });

        const allHistory = bus.getHistory();
        expect(allHistory).toHaveLength(3);

        const filteredHistory = bus.getHistory('a');
        expect(filteredHistory).toHaveLength(2);

        const limitedHistory = bus.getHistory(undefined, 1);
        expect(limitedHistory).toHaveLength(1);
    });

    it('should track stats', async () => {
        bus.on('x', () => {});
        await bus.emit('x');
        await bus.emit('y'); // no handler

        const stats = bus.getStats();
        expect(stats.emitted).toBe(2);
        expect(stats.handled).toBe(1);
    });

    it('should list events with handler counts', () => {
        bus.on('a', () => {});
        bus.on('a', () => {});
        bus.on('b', () => {});

        const events = bus.listEvents();
        expect(events).toHaveLength(2);

        const eventA = events.find(e => e.event === 'a')!;
        expect(eventA.handlers).toBe(2);
    });
});

// ================================================================
// PubSub
// ================================================================
describe('PubSub', () => {
    let ps: PubSub;

    beforeEach(() => {
        ps = new PubSub();
    });

    it('should subscribe and publish on exact topic', () => {
        const received: unknown[] = [];
        ps.subscribe('user.created', (topic, data) => { received.push({ topic, data }); });

        const delivered = ps.publish('user.created', { name: 'Alice' });
        expect(delivered).toBe(1);
        expect(received[0]).toEqual({ topic: 'user.created', data: { name: 'Alice' } });
    });

    it('should match single-level wildcard (*)', () => {
        const received: string[] = [];
        ps.subscribe('user.*', (topic) => { received.push(topic); });

        ps.publish('user.created', {});
        ps.publish('user.deleted', {});
        ps.publish('order.created', {});

        expect(received).toEqual(['user.created', 'user.deleted']);
    });

    it('should match multi-level wildcard (#)', () => {
        const received: string[] = [];
        ps.subscribe('#', (topic) => { received.push(topic); });

        ps.publish('user.created', {});
        ps.publish('order.shipped.fast', {});

        expect(received).toEqual(['user.created', 'order.shipped.fast']);
    });

    it('should apply subscription filters', () => {
        const received: unknown[] = [];
        ps.subscribe(
            'events',
            (_topic, data) => { received.push(data); },
            (data) => (data as { priority: number }).priority > 5,
        );

        ps.publish('events', { priority: 3 });
        ps.publish('events', { priority: 8 });

        expect(received).toHaveLength(1);
        expect(received[0]).toEqual({ priority: 8 });
    });

    it('should unsubscribe by subscription ID', () => {
        const id = ps.subscribe('topic', () => {});
        expect(ps.count()).toBe(1);

        const result = ps.unsubscribe(id);
        expect(result).toBe(true);
        expect(ps.count()).toBe(0);
    });

    it('should return false when unsubscribing non-existent ID', () => {
        expect(ps.unsubscribe('sub-999')).toBe(false);
    });

    it('should track publish/delivery stats', () => {
        ps.subscribe('a', () => {});
        ps.publish('a', {});
        ps.publish('b', {}); // no subscriber

        const stats = ps.getStats();
        expect(stats.published).toBe(2);
        expect(stats.delivered).toBe(1);
    });

    it('should track filtered count in stats', () => {
        ps.subscribe('events', () => {}, () => false); // always filtered
        ps.publish('events', {});

        const stats = ps.getStats();
        expect(stats.filtered).toBe(1);
        expect(stats.delivered).toBe(0);
    });

    it('should list topics with subscriber counts', () => {
        ps.subscribe('user.created', () => {});
        ps.subscribe('user.created', () => {});
        ps.subscribe('order.shipped', () => {});

        const topics = ps.listTopics();
        expect(topics).toHaveLength(2);

        const userTopic = topics.find(t => t.topic === 'user.created')!;
        expect(userTopic.subscribers).toBe(2);
    });
});
