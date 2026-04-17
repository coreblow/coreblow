/**
 * Tests: Channel Policy — Inbound Debounce Engine + Policy Wrapper
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createInboundDebouncer } from '../../src/channels/policy/inbound-debounce.js';
import {
    resolveInboundDebounceMs,
    createChannelInboundDebouncer,
} from '../../src/channels/policy/inbound-debounce-policy.js';

// ─── inbound-debounce.ts tests ────────────────────────────────────────────────

describe('createInboundDebouncer', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('flushes items after debounce window', async () => {
        const flushed: string[][] = [];
        const debouncer = createInboundDebouncer<string>({
            debounceMs: 100,
            buildKey: (item) => 'key1',
            onFlush: async (items) => { flushed.push([...items]); },
        });

        const p = debouncer.add('hello');
        vi.advanceTimersByTime(100);
        await p;

        expect(flushed).toHaveLength(1);
        expect(flushed[0]).toEqual(['hello']);
    });

    it('batches multiple items from same key', async () => {
        const flushed: string[][] = [];
        const debouncer = createInboundDebouncer<string>({
            debounceMs: 100,
            buildKey: () => 'user1',
            onFlush: async (items) => { flushed.push([...items]); },
        });

        void debouncer.add('msg1');
        void debouncer.add('msg2');
        const p = debouncer.add('msg3');
        vi.advanceTimersByTime(100);
        await p;

        expect(flushed).toHaveLength(1);
        expect(flushed[0]).toHaveLength(3);
    });

    it('isolates buffers by key', async () => {
        const flushed: Record<string, string[]> = {};
        const debouncer = createInboundDebouncer<{ key: string; msg: string }>({
            debounceMs: 100,
            buildKey: (item) => item.key,
            onFlush: async (items) => {
                const key = items[0].key;
                flushed[key] = items.map((i) => i.msg);
            },
        });

        void debouncer.add({ key: 'user1', msg: 'a' });
        void debouncer.add({ key: 'user1', msg: 'b' });
        const p2 = debouncer.add({ key: 'user2', msg: 'c' });
        vi.advanceTimersByTime(100);
        await p2;

        expect(flushed['user1']).toEqual(['a', 'b']);
        expect(flushed['user2']).toEqual(['c']);
    });

    it('bypasses debounce when shouldDebounce returns false', async () => {
        const flushed: string[][] = [];
        const debouncer = createInboundDebouncer<string>({
            debounceMs: 1000,
            buildKey: () => 'key',
            shouldDebounce: (item) => !item.startsWith('/'),
            onFlush: async (items) => { flushed.push([...items]); },
        });

        void debouncer.add('/help'); // command — should bypass
        await vi.runAllTimersAsync();

        expect(flushed).toHaveLength(1);
        expect(flushed[0]).toEqual(['/help']);
    });

    it('flushes all pending on flushAll()', async () => {
        const flushed: string[][] = [];
        const debouncer = createInboundDebouncer<string>({
            debounceMs: 5000,
            buildKey: () => 'key',
            onFlush: async (items) => { flushed.push([...items]); },
        });

        void debouncer.add('msg1');
        void debouncer.add('msg2');
        await debouncer.flushAll();

        expect(flushed).toHaveLength(1);
        expect(flushed[0]).toHaveLength(2);
    });

    it('reports stats', () => {
        const debouncer = createInboundDebouncer<string>({
            debounceMs: 5000,
            buildKey: () => 'key',
            onFlush: async () => {},
        });

        void debouncer.add('msg');
        const s = debouncer.stats();
        expect(s.activeKeys).toBe(1);
        expect(s.pendingItems).toBe(1);
    });

    it('handles onFlush error via onError without throwing', async () => {
        const errors: unknown[] = [];
        const debouncer = createInboundDebouncer<string>({
            debounceMs: 100,
            buildKey: () => 'key',
            onFlush: async () => { throw new Error('flush failed'); },
            onError: (err) => { errors.push(err); },
        });

        const p = debouncer.add('msg');
        vi.advanceTimersByTime(100);
        await p;

        expect(errors).toHaveLength(1);
    });

    it('handles unkeyed items (null key) — flush immediately', async () => {
        const flushed: string[][] = [];
        const debouncer = createInboundDebouncer<string>({
            debounceMs: 1000,
            buildKey: () => null,
            onFlush: async (items) => { flushed.push([...items]); },
        });

        await debouncer.add('instant');
        expect(flushed).toHaveLength(1);
        expect(flushed[0]).toEqual(['instant']);
    });
});

// ─── inbound-debounce-policy.ts tests ────────────────────────────────────────

describe('resolveInboundDebounceMs', () => {
    it('returns 0 if no policy', () => {
        expect(resolveInboundDebounceMs({ channel: 'discord' })).toBe(0);
    });

    it('returns global debounceMs', () => {
        expect(resolveInboundDebounceMs({
            policy: { debounceMs: 200 },
            channel: 'telegram',
        })).toBe(200);
    });

    it('returns per-channel override over global', () => {
        expect(resolveInboundDebounceMs({
            policy: { debounceMs: 200, byChannel: { discord: 500 } },
            channel: 'discord',
        })).toBe(500);
    });

    it('returns overrideMs as highest priority', () => {
        expect(resolveInboundDebounceMs({
            policy: { debounceMs: 200, byChannel: { discord: 500 } },
            channel: 'discord',
            overrideMs: 999,
        })).toBe(999);
    });

    it('ignores non-finite values', () => {
        expect(resolveInboundDebounceMs({
            policy: { debounceMs: Infinity },
            channel: 'discord',
        })).toBe(0);
    });
});

describe('createChannelInboundDebouncer', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('creates debouncer with resolved debounceMs', () => {
        const { debounceMs, debouncer } = createChannelInboundDebouncer({
            policy: { byChannel: { discord: 300 } },
            channel: 'discord',
            buildKey: () => 'key',
            onFlush: async () => {},
        });

        expect(debounceMs).toBe(300);
        expect(typeof debouncer.add).toBe('function');
    });
});
