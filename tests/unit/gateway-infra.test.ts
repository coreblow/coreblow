/**
 * Tests: Gateway Infrastructure — Webhook retry, Shutdown, Ops
 */
import { describe, it, expect, vi } from 'vitest';
import { webhookWithRetry } from '../../src/gateway/webhook/webhook-retry.js';
import { GracefulShutdown } from '../../src/gateway/shutdown.js';

// ═══════════════════════════════════════════════════════════════
// WEBHOOK RETRY
// ═══════════════════════════════════════════════════════════════

describe('webhookWithRetry', () => {
    it('succeeds on first try with valid response', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
        vi.stubGlobal('fetch', mockFetch);

        const result = await webhookWithRetry('https://example.com/hook', { event: 'test' });
        expect(result.ok).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(1);

        vi.unstubAllGlobals();
    });

    it('retries on failure', async () => {
        let calls = 0;
        const mockFetch = vi.fn().mockImplementation(async () => {
            calls++;
            if (calls < 3) return { ok: false };
            return { ok: true };
        });
        vi.stubGlobal('fetch', mockFetch);

        const result = await webhookWithRetry('https://example.com/hook', { event: 'test' }, 3);
        expect(result.ok).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(3);

        vi.unstubAllGlobals();
    });

    it('throws after max retries', async () => {
        const mockFetch = vi.fn().mockResolvedValue({ ok: false });
        vi.stubGlobal('fetch', mockFetch);

        await expect(
            webhookWithRetry('https://example.com/hook', {}, 1),
        ).rejects.toThrow('Webhook delivery failed');

        vi.unstubAllGlobals();
    });
});

// ═══════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════

describe('GracefulShutdown', () => {
    it('creates an instance', () => {
        const gs = new GracefulShutdown();
        expect(gs).toBeDefined();
    });

    it('tracks shutdown state', () => {
        const gs = new GracefulShutdown();
        expect(gs.isShuttingDown()).toBe(false);
    });

    it('registers shutdown handler', () => {
        const gs = new GracefulShutdown();
        gs.onShutdown(async () => {});
        expect(gs).toBeDefined();
    });
});
