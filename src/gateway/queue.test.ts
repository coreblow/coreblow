// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { MessageQueue } from './queue.js';

describe('Message Queue — Phase 14', () => {
    let queue: MessageQueue;

    const mockMessage = (text: string) => ({
        sessionId: 'sess-1',
        senderId: 'user-1',
        channel: 'discord',
        text,
    });

    beforeEach(() => {
        queue = new MessageQueue({
            maxSize: 10,
            concurrency: 2,
            maxAttempts: 3,
            processIntervalMs: 50,
            deadLetterMaxSize: 5,
        });
    });

    it('enqueues messages', () => {
        const item = queue.enqueue(mockMessage('hello'));
        expect(item).not.toBeNull();
        expect(item!.id).toBeTruthy();
        expect(item!.priority).toBe('normal');
        expect(queue.size()).toBe(1);
    });

    it('respects max size (backpressure)', () => {
        for (let i = 0; i < 10; i++) {
            queue.enqueue(mockMessage(`msg-${i}`));
        }
        const overflow = queue.enqueue(mockMessage('overflow'));
        expect(overflow).toBeNull();
        expect(queue.size()).toBe(10);
    });

    it('enqueues with priority', () => {
        queue.enqueue(mockMessage('low'), 'low');
        queue.enqueue(mockMessage('high'), 'high');
        queue.enqueue(mockMessage('normal'), 'normal');
        expect(queue.size()).toBe(3);
    });

    it('enqueues delayed message', () => {
        const item = queue.enqueueDelayed(mockMessage('delayed'), 5000);
        expect(item).not.toBeNull();
        expect(item!.processAfter).toBeGreaterThan(Date.now());
    });

    it('processes messages via flush', async () => {
        const processed: string[] = [];
        queue.setProcessor(async (item) => {
            processed.push(item.message.text);
        });

        queue.enqueue(mockMessage('a'));
        queue.enqueue(mockMessage('b'));
        queue.enqueue(mockMessage('c'));

        await queue.flush();
        expect(processed).toEqual(['a', 'b', 'c']);
    });

    it('processes high priority first', async () => {
        const processed: string[] = [];
        queue.setProcessor(async (item) => {
            processed.push(item.message.text);
        });

        queue.enqueue(mockMessage('low'), 'low');
        queue.enqueue(mockMessage('normal'), 'normal');
        queue.enqueue(mockMessage('high'), 'high');

        await queue.flush();
        expect(processed[0]).toBe('high');
    });

    it('moves failed items to dead letter after max attempts', async () => {
        let callCount = 0;
        queue.setProcessor(async () => {
            callCount++;
            throw new Error('fail');
        });

        queue.enqueue(mockMessage('bad'));

        // First flush processes the item (attempt 1), then re-enqueues with delay
        await queue.flush();
        // Clear processAfter so flush can process again
        // Access internal queues to clear delay
        const allQueues = [queue['queues'].high, queue['queues'].normal, queue['queues'].low];
        for (const q of allQueues) {
            for (const item of q) item.processAfter = undefined;
        }
        await queue.flush(); // attempt 2
        for (const q of allQueues) {
            for (const item of q) item.processAfter = undefined;
        }
        await queue.flush(); // attempt 3 → dead letter

        const deadLetters = queue.getDeadLetters();
        expect(deadLetters).toHaveLength(1);
        expect(deadLetters[0].message.text).toBe('bad');
        expect(callCount).toBe(3);
    });

    it('retries dead letter', async () => {
        queue.setProcessor(async () => {
            throw new Error('fail');
        });

        queue.enqueue(mockMessage('bad'));
        // Exhaust all attempts
        const allQueues = [queue['queues'].high, queue['queues'].normal, queue['queues'].low];
        await queue.flush();
        for (const q of allQueues) { for (const item of q) item.processAfter = undefined; }
        await queue.flush();
        for (const q of allQueues) { for (const item of q) item.processAfter = undefined; }
        await queue.flush();

        const dl = queue.getDeadLetters();
        expect(dl).toHaveLength(1);

        const retried = queue.retryDeadLetter(dl[0].id);
        expect(retried).toBe(true);
        expect(queue.size()).toBe(1);
        expect(queue.getDeadLetters()).toHaveLength(0);
    });

    it('retryDeadLetter returns false for unknown id', () => {
        expect(queue.retryDeadLetter('nonexistent')).toBe(false);
    });

    it('getStats reports correct values', async () => {
        const processed: string[] = [];
        queue.setProcessor(async (item) => {
            processed.push(item.message.text);
        });

        queue.enqueue(mockMessage('a'));
        queue.enqueue(mockMessage('b'));
        await queue.flush();

        const stats = queue.getStats();
        expect(stats.processed).toBe(2);
        expect(stats.failed).toBe(0);
        expect(stats.size).toBe(0);
        expect(stats.deadLetterSize).toBe(0);
        expect(stats.avgProcessTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('clear removes all items', () => {
        queue.enqueue(mockMessage('a'));
        queue.enqueue(mockMessage('b'), 'high');
        queue.clear();
        expect(queue.size()).toBe(0);
        expect(queue.getDeadLetters()).toHaveLength(0);
    });

    it('pause/resume controls processing', () => {
        queue.pause();
        // Verify paused state by starting (timer won't process while paused)
        queue.start();
        queue.resume();
        queue.stop();
    });

    it('start/stop lifecycle', () => {
        queue.start();
        expect(() => queue.stop()).not.toThrow();
    });

    it('double start is safe', () => {
        queue.start();
        queue.start(); // Should not create duplicate timers
        queue.stop();
    });
});
