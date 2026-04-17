// @ts-nocheck
/**
 * auto-reply/debounce.test.ts — Inbound debounce tests
 */
import { describe, it, expect, vi } from 'vitest';
import { createInboundDebouncer, resolveInboundDebounceMs } from './inbound-debounce.js';

describe('Inbound Debounce', () => {
    describe('resolveInboundDebounceMs', () => {
        it('returns 0 when no config', () => {
            expect(resolveInboundDebounceMs({ cfg: {}, channel: 'discord' })).toBe(0);
        });

        it('uses base debounce from config', () => {
            const cfg = { messages: { inbound: { debounceMs: 500 } } };
            expect(resolveInboundDebounceMs({ cfg, channel: 'discord' })).toBe(500);
        });

        it('uses channel override', () => {
            const cfg = { messages: { inbound: { debounceMs: 500, byChannel: { discord: 200 } } } };
            expect(resolveInboundDebounceMs({ cfg, channel: 'discord' })).toBe(200);
        });

        it('uses explicit override over channel', () => {
            const cfg = { messages: { inbound: { debounceMs: 500, byChannel: { discord: 200 } } } };
            expect(resolveInboundDebounceMs({ cfg, channel: 'discord', overrideMs: 100 })).toBe(100);
        });

        it('ignores non-number values', () => {
            const cfg = { messages: { inbound: { debounceMs: 'invalid' } } };
            expect(resolveInboundDebounceMs({ cfg, channel: 'discord' })).toBe(0);
        });
    });

    describe('createInboundDebouncer', () => {
        it('flushes immediately when debounceMs is 0', async () => {
            const flushed: string[][] = [];
            const debouncer = createInboundDebouncer<string>({
                debounceMs: 0,
                buildKey: (item) => item.slice(0, 3),
                onFlush: async (items) => { flushed.push(items); },
            });
            await debouncer.enqueue('abc-1');
            expect(flushed).toHaveLength(1);
            expect(flushed[0]).toEqual(['abc-1']);
        });

        it('batches messages with same key', async () => {
            const flushed: string[][] = [];
            const debouncer = createInboundDebouncer<string>({
                debounceMs: 50,
                buildKey: (item) => 'key',
                onFlush: async (items) => { flushed.push(items); },
            });
            await debouncer.enqueue('msg-1');
            await debouncer.enqueue('msg-2');
            await debouncer.enqueue('msg-3');
            // Wait for debounce to flush
            await new Promise((r) => setTimeout(r, 100));
            expect(flushed).toHaveLength(1);
            expect(flushed[0]).toEqual(['msg-1', 'msg-2', 'msg-3']);
        });

        it('separates messages with different keys', async () => {
            const flushed: string[][] = [];
            const debouncer = createInboundDebouncer<string>({
                debounceMs: 50,
                buildKey: (item) => item.split('-')[0],
                onFlush: async (items) => { flushed.push(items); },
            });
            await debouncer.enqueue('a-1');
            await debouncer.enqueue('b-1');
            await new Promise((r) => setTimeout(r, 100));
            expect(flushed).toHaveLength(2);
        });

        it('calls onError for flush failures', async () => {
            const errors: unknown[] = [];
            const debouncer = createInboundDebouncer<string>({
                debounceMs: 0,
                buildKey: () => 'key',
                onFlush: async () => { throw new Error('flush-fail'); },
                onError: (err) => { errors.push(err); },
            });
            await debouncer.enqueue('test');
            expect(errors).toHaveLength(1);
            expect((errors[0] as Error).message).toBe('flush-fail');
        });

        it('respects shouldDebounce', async () => {
            const flushed: string[][] = [];
            const debouncer = createInboundDebouncer<string>({
                debounceMs: 50,
                buildKey: () => 'key',
                shouldDebounce: (item) => item !== 'urgent',
                onFlush: async (items) => { flushed.push(items); },
            });
            await debouncer.enqueue('urgent');
            expect(flushed).toHaveLength(1);
        });

        it('handles null key', async () => {
            const flushed: string[][] = [];
            const debouncer = createInboundDebouncer<string>({
                debounceMs: 50,
                buildKey: () => null,
                onFlush: async (items) => { flushed.push(items); },
            });
            await debouncer.enqueue('msg');
            expect(flushed).toHaveLength(1);
        });
    });
});
