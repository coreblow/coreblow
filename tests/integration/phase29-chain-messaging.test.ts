/**
 * CoreBlow Phase 29 — Messaging Chain Integration Tests
 *
 * Layer 2 (Pipeline Orchestration):
 *   EventBus → MessageBroker → PubSub → HookBus
 *
 * Tests the full messaging pipeline as it would execute in production:
 *   1. EventBus captures domain events
 *   2. MessageBroker queues work for consumers
 *   3. PubSub broadcasts to topic subscribers
 *   4. HookBus fires hooks with wildcard resolution
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EventBus } from '../../src/infra/event-bus.js';
import { MessageBroker } from '../../src/infra/message-broker.js';
import { PubSub } from '../../src/infra/pub-sub.js';
import { HookBus } from '../../src/hooks/hook-bus.js';
import { EventStore } from '../../src/infra/event-sourcing.js';

describe('Phase29 Chain: Messaging Pipeline', () => {
    let eventBus: EventBus;
    let broker: MessageBroker;
    let pubsub: PubSub;
    let hookBus: HookBus;
    let audit: EventStore;

    beforeEach(() => {
        eventBus = new EventBus();
        broker = new MessageBroker();
        pubsub = new PubSub();
        hookBus = new HookBus();
        audit = new EventStore();
    });

    // ── Event Propagation ──

    it('EventBus emit → MessageBroker publish → PubSub delivery', async () => {
        const delivered: unknown[] = [];

        // Wire: EventBus → MessageBroker → PubSub
        eventBus.on('order:created', async (data) => {
            broker.publish('order-processing', data);
        });

        broker.subscribe('order-processing', async (msg) => {
            pubsub.publish('notifications.order', msg.payload);
            return true;
        });

        pubsub.subscribe('notifications.order', (_topic, data) => {
            delivered.push(data);
        });

        // Trigger the chain
        await eventBus.emit('order:created', { orderId: 'ORD-001', total: 99.99 });
        await broker.processNext('order-processing');

        // Verify end-to-end delivery
        expect(delivered).toHaveLength(1);
        expect((delivered[0] as Record<string, unknown>).orderId).toBe('ORD-001');

        // Verify stats across the chain
        expect(eventBus.getStats().emitted).toBe(1);
        expect(broker.getStats().consumed).toBe(1);
        expect(pubsub.getStats().delivered).toBe(1);
    });

    it('HookBus fire → EventBus listener → EventStore audit trail', async () => {
        // Wire: HookBus → EventBus → EventStore
        hookBus.on('message:received', async (data) => {
            await eventBus.emit('hook:triggered', data);
        });

        eventBus.on('hook:triggered', async (data) => {
            audit.append('hook:triggered', 'msg-pipeline', data as Record<string, unknown>);
        });

        // Fire the hook
        await hookBus.fire('message:received', { content: 'hello', from: 'user-1' });

        // Verify audit trail
        const trail = audit.getEvents('msg-pipeline');
        expect(trail).toHaveLength(1);
        expect(trail[0]!.payload.content).toBe('hello');
    });

    it('wildcard routing: PubSub # catches all, EventBus once auto-removes', async () => {
        const pubsubReceived: string[] = [];
        const eventBusReceived: string[] = [];

        // PubSub wildcard catches everything
        pubsub.subscribe('#', (topic) => { pubsubReceived.push(topic); });

        // EventBus once fires only once
        eventBus.once('ping', () => { eventBusReceived.push('pong'); });

        pubsub.publish('user.created', {});
        pubsub.publish('order.shipped', {});
        pubsub.publish('system.health', {});

        await eventBus.emit('ping');
        await eventBus.emit('ping'); // Should not trigger again

        expect(pubsubReceived).toEqual(['user.created', 'order.shipped', 'system.health']);
        expect(eventBusReceived).toEqual(['pong']); // Only once
    });

    // ── Message Processing ──

    it('MessageBroker queue → consumer processes → PubSub notifies completion', async () => {
        const notifications: string[] = [];

        // Consumer processes and publishes completion
        broker.subscribe('jobs', async (msg) => {
            const payload = msg.payload as { jobName: string };
            pubsub.publish('job.completed', { name: payload.jobName, processedAt: Date.now() });
            return true;
        });

        pubsub.subscribe('job.completed', (_topic, data) => {
            notifications.push((data as { name: string }).name);
        });

        // Publish 3 jobs
        broker.publish('jobs', { jobName: 'export' });
        broker.publish('jobs', { jobName: 'cleanup' });
        broker.publish('jobs', { jobName: 'report' });

        // Process all 3
        await broker.processNext('jobs');
        await broker.processNext('jobs');
        await broker.processNext('jobs');

        expect(notifications).toEqual(['export', 'cleanup', 'report']);
        expect(broker.getStats().consumed).toBe(3);
    });

    it('failed consumer → retry → DeadLetterQueue via EventBus notification', async () => {
        const dlqNotifications: unknown[] = [];

        // Consumer always fails
        broker.subscribe('payments', async () => {
            throw new Error('payment gateway down');
        });

        // EventBus listens for DLQ events
        eventBus.on('dlq:payment-failed', (data) => {
            dlqNotifications.push(data);
        });

        // Publish with maxAttempts=1 (immediate failure)
        broker.publish('payments', { amount: 50 }, 0, 1);
        const result = await broker.processNext('payments');

        // Notify via EventBus that payment failed permanently
        if (result && result.status === 'failed') {
            await eventBus.emit('dlq:payment-failed', {
                queue: 'payments',
                payload: result.payload,
                error: 'Exhausted all attempts',
            });
        }

        expect(result!.status).toBe('failed');
        expect(broker.getStats().failed).toBe(1);
        expect(dlqNotifications).toHaveLength(1);
    });

    it('priority ordering maintained across MessageBroker → PubSub chain', async () => {
        const processOrder: number[] = [];

        broker.subscribe('priority-queue', async (msg) => {
            const priority = (msg.payload as { priority: number }).priority;
            processOrder.push(priority);
            pubsub.publish('processed', { priority });
            return true;
        });

        // Publish in random order, different priorities
        broker.publish('priority-queue', { priority: 1 }, 1);
        broker.publish('priority-queue', { priority: 10 }, 10);
        broker.publish('priority-queue', { priority: 5 }, 5);

        await broker.processNext('priority-queue');
        await broker.processNext('priority-queue');
        await broker.processNext('priority-queue');

        // Should process in priority order (highest first)
        expect(processOrder).toEqual([10, 5, 1]);
    });
});
