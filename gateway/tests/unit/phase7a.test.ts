/**
 * tests/unit/phase7a.test.ts
 * Phase 7A tests — Queue, Retry, Priority Routing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ======= QUEUE TESTS =======

describe('Message Queue', () => {
    let MessageQueue: any;

    beforeEach(async () => {
        const mod = await import('../../src/gateway/queue.js');
        MessageQueue = mod.MessageQueue;
    });

    it('should enqueue messages', () => {
        const q = new MessageQueue();
        const msg = { channel: 'test', senderId: 'u1', senderName: 'User', sessionId: 's1', text: 'hi', timestamp: Date.now() } as any;
        const item = q.enqueue(msg);
        expect(item).not.toBeNull();
        expect(q.size()).toBe(1);
    });

    it('should respect max size (backpressure)', () => {
        const q = new MessageQueue({ maxSize: 2 });
        const msg = { channel: 'test', senderId: 'u1', senderName: 'User', sessionId: 's1', text: 'hi', timestamp: Date.now() } as any;
        q.enqueue(msg);
        q.enqueue(msg);
        const result = q.enqueue(msg); // should fail
        expect(result).toBeNull();
    });

    it('should process with priority order', async () => {
        const q = new MessageQueue();
        const processed: string[] = [];

        q.setProcessor(async (item: any) => { processed.push(item.priority); });

        const msg = { channel: 'test', senderId: 'u1', senderName: 'User', sessionId: 's1', text: 'hi', timestamp: Date.now() } as any;
        q.enqueue(msg, 'low');
        q.enqueue(msg, 'high');
        q.enqueue(msg, 'normal');

        await q.flush();

        expect(processed[0]).toBe('high');
        expect(processed[1]).toBe('normal');
        expect(processed[2]).toBe('low');
    });

    it('should move failed items to dead letter after max attempts', async () => {
        const q = new MessageQueue({ maxAttempts: 1 });
        q.setProcessor(async () => { throw new Error('fail'); });

        const msg = { channel: 'test', senderId: 'u1', senderName: 'User', sessionId: 's1', text: 'hi', timestamp: Date.now() } as any;
        q.enqueue(msg);

        await q.flush();

        expect(q.getDeadLetters()).toHaveLength(1);
    });

    it('should retry dead letter items', async () => {
        const q = new MessageQueue({ maxAttempts: 1 });
        let callCount = 0;
        q.setProcessor(async () => {
            callCount++;
            if (callCount === 1) throw new Error('fail');
        });

        const msg = { channel: 'test', senderId: 'u1', senderName: 'User', sessionId: 's1', text: 'hi', timestamp: Date.now() } as any;
        q.enqueue(msg);
        await q.flush();

        expect(q.getDeadLetters()).toHaveLength(1);
        const dlItem = q.getDeadLetters()[0];
        expect(q.retryDeadLetter(dlItem.id)).toBe(true);
        expect(q.size()).toBe(1);
    });

    it('should enqueue with delay', () => {
        const q = new MessageQueue();
        const msg = { channel: 'test', senderId: 'u1', senderName: 'User', sessionId: 's1', text: 'hi', timestamp: Date.now() } as any;
        const item = q.enqueueDelayed(msg, 5000);
        expect(item?.processAfter).toBeGreaterThan(Date.now());
    });

    it('should clear queue', () => {
        const q = new MessageQueue();
        const msg = { channel: 'test', senderId: 'u1', senderName: 'User', sessionId: 's1', text: 'hi', timestamp: Date.now() } as any;
        q.enqueue(msg);
        q.clear();
        expect(q.size()).toBe(0);
    });

    it('should get stats', () => {
        const q = new MessageQueue();
        const stats = q.getStats();
        expect(stats).toHaveProperty('size');
        expect(stats).toHaveProperty('processing');
        expect(stats).toHaveProperty('processed');
        expect(stats).toHaveProperty('deadLetterSize');
    });

    it('should start and stop processing', () => {
        const q = new MessageQueue();
        q.setProcessor(async () => { });
        q.start();
        q.stop();
        // Should not throw
    });

    it('should pause and resume', () => {
        const q = new MessageQueue();
        q.pause();
        q.resume();
        // Should not throw
    });
});

// ======= RETRY TESTS =======

describe('Retry Logic', () => {
    let withRetry: any, calculateDelay: any;

    beforeEach(async () => {
        const mod = await import('../../src/gateway/retry.js');
        withRetry = mod.withRetry;
        calculateDelay = mod.calculateDelay;
    });

    it('should succeed on first attempt', async () => {
        const result = await withRetry(async () => 'ok');
        expect(result.success).toBe(true);
        expect(result.result).toBe('ok');
        expect(result.attempts).toBe(1);
    });

    it('should retry on failure', async () => {
        let count = 0;
        const result = await withRetry(async () => {
            count++;
            if (count < 3) throw new Error('fail');
            return 'ok';
        }, { maxAttempts: 3, baseDelayMs: 10 });
        expect(result.success).toBe(true);
        expect(result.attempts).toBe(3);
    });

    it('should fail after max attempts', async () => {
        const result = await withRetry(async () => {
            throw new Error('always fails');
        }, { maxAttempts: 2, baseDelayMs: 10 });
        expect(result.success).toBe(false);
        expect(result.attempts).toBe(2);
    });

    it('should not retry non-retryable errors', async () => {
        const result = await withRetry(async () => {
            throw new Error('invalid auth');
        }, { maxAttempts: 5, baseDelayMs: 10, nonRetryableErrors: ['invalid auth'] });
        expect(result.success).toBe(false);
        expect(result.attempts).toBe(1);
    });

    it('should calculate exponential delay', () => {
        const d1 = calculateDelay(1, { baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, jitter: false, maxAttempts: 3 });
        const d2 = calculateDelay(2, { baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, jitter: false, maxAttempts: 3 });
        const d3 = calculateDelay(3, { baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 30000, jitter: false, maxAttempts: 3 });
        expect(d1).toBe(1000);
        expect(d2).toBe(2000);
        expect(d3).toBe(4000);
    });

    it('should cap delay at max', () => {
        const d = calculateDelay(10, { baseDelayMs: 1000, backoffMultiplier: 2, maxDelayMs: 5000, jitter: false, maxAttempts: 10 });
        expect(d).toBe(5000);
    });
});

// ======= CIRCUIT BREAKER TESTS =======

describe('Circuit Breaker', () => {
    let CircuitBreaker: any;

    beforeEach(async () => {
        const mod = await import('../../src/gateway/retry.js');
        CircuitBreaker = mod.CircuitBreaker;
    });

    it('should start closed', () => {
        const cb = new CircuitBreaker('test');
        expect(cb.getState()).toBe('closed');
    });

    it('should stay closed on success', async () => {
        const cb = new CircuitBreaker('test');
        await cb.execute(async () => 'ok');
        expect(cb.getState()).toBe('closed');
    });

    it('should open after failure threshold', async () => {
        const cb = new CircuitBreaker('test', { failureThreshold: 3 });
        for (let i = 0; i < 3; i++) {
            try { await cb.execute(async () => { throw new Error('fail'); }); } catch { }
        }
        expect(cb.getState()).toBe('open');
    });

    it('should reject calls when open', async () => {
        const cb = new CircuitBreaker('test', { failureThreshold: 1 });
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch { }
        await expect(cb.execute(async () => 'ok')).rejects.toThrow('OPEN');
    });

    it('should transition to half-open after reset time', async () => {
        const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeMs: 1 });
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch { }
        // Wait for reset time
        await new Promise(r => setTimeout(r, 10));
        expect(cb.getState()).toBe('half-open');
    });

    it('should close after successes in half-open', async () => {
        const cb = new CircuitBreaker('test', { failureThreshold: 1, resetTimeMs: 1, successThreshold: 2 });
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch { }
        await new Promise(r => setTimeout(r, 10));

        // Two successes should close the circuit
        await cb.execute(async () => 'ok');
        await cb.execute(async () => 'ok');
        expect(cb.getState()).toBe('closed');
    });

    it('should force reset', async () => {
        const cb = new CircuitBreaker('test', { failureThreshold: 1 });
        // Manually trip
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch { }
        cb.reset();
        expect(cb.getState()).toBe('closed');
    });

    it('should fire state change listeners', async () => {
        const cb = new CircuitBreaker('test', { failureThreshold: 1 });
        let newState: string = '';
        cb.onStateChange((s: string) => { newState = s; });
        try { await cb.execute(async () => { throw new Error('fail'); }); } catch { }
        expect(newState).toBe('open');
    });

    it('should get info', () => {
        const cb = new CircuitBreaker('my-breaker');
        const info = cb.getInfo();
        expect(info.name).toBe('my-breaker');
        expect(info.state).toBe('closed');
    });
});

// ======= PRIORITY ROUTING TESTS =======

describe('Priority Router', () => {
    let PriorityRouter: any;

    beforeEach(async () => {
        const mod = await import('../../src/gateway/priority.js');
        PriorityRouter = mod.PriorityRouter;
    });

    it('should default to normal priority', () => {
        const pr = new PriorityRouter();
        const result = pr.resolve({ senderId: 'u1', channel: 'test', text: 'hello' } as any);
        expect(result.tier).toBe('normal');
    });

    it('should prioritize VIP users', () => {
        const pr = new PriorityRouter();
        pr.addVip('u1');
        const result = pr.resolve({ senderId: 'u1', channel: 'test', text: 'hello' } as any);
        expect(result.tier).toBe('high');
    });

    it('should match by userId rule', () => {
        const pr = new PriorityRouter();
        pr.addRule({ id: 'r1', match: { userId: 'boss' }, priority: 'critical' });
        const result = pr.resolve({ senderId: 'boss', channel: 'test', text: 'hello' } as any);
        expect(result.tier).toBe('critical');
    });

    it('should match by channel rule', () => {
        const pr = new PriorityRouter();
        pr.addRule({ id: 'r1', match: { channel: 'telegram' }, priority: 'high' });
        const result = pr.resolve({ senderId: 'u1', channel: 'telegram', text: 'hello' } as any);
        expect(result.tier).toBe('high');
    });

    it('should match by pattern rule', () => {
        const pr = new PriorityRouter();
        pr.addRule({ id: 'r1', match: { pattern: /urgent/i }, priority: 'critical' });
        const result = pr.resolve({ senderId: 'u1', channel: 'test', text: 'URGENT: help' } as any);
        expect(result.tier).toBe('critical');
    });

    it('should provide model override from rule', () => {
        const pr = new PriorityRouter();
        pr.addRule({ id: 'r1', match: { userId: 'vip' }, priority: 'high', model: 'gpt-4' });
        const result = pr.resolve({ senderId: 'vip', channel: 'test', text: 'hi' } as any);
        expect(result.model).toBe('gpt-4');
    });

    it('should remove VIP', () => {
        const pr = new PriorityRouter();
        pr.addVip('u1');
        expect(pr.isVip('u1')).toBe(true);
        pr.removeVip('u1');
        expect(pr.isVip('u1')).toBe(false);
    });

    it('should remove rules', () => {
        const pr = new PriorityRouter();
        pr.addRule({ id: 'r1', match: { channel: 'test' }, priority: 'high' });
        expect(pr.removeRule('r1')).toBe(true);
        expect(pr.listRules()).toHaveLength(0);
    });

    it('should track load and find least loaded', () => {
        const pr = new PriorityRouter();
        pr.updateLoad('channel-a', 10, 500, 0.1);
        pr.updateLoad('channel-b', 2, 200, 0);
        expect(pr.getLeastLoaded()).toBe('channel-b');
    });

    it('should get stats', () => {
        const pr = new PriorityRouter();
        pr.addVip('u1');
        pr.addRule({ id: 'r1', match: { channel: 'test' }, priority: 'high' });
        pr.recordTierUsage('high');
        const stats = pr.getStats();
        expect(stats.vipUsers).toBe(1);
        expect(stats.rules).toBe(1);
        expect(stats.tierUsage.high).toBe(1);
    });
});
