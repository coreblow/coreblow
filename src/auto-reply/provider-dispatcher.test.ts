import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderDispatcher } from './reply/provider-dispatcher-class.js';

describe('Provider Dispatcher — Phase 11', () => {
    let dispatcher: ProviderDispatcher;

    const mockRoutes = [
        { providerId: 'openai', model: 'gpt-4o', priority: 10, maxRetries: 3, timeoutMs: 30000, isAvailable: true },
        { providerId: 'anthropic', model: 'claude-sonnet-4-20250514', priority: 5, maxRetries: 3, timeoutMs: 30000, isAvailable: true },
        { providerId: 'google', model: 'gemini-pro', priority: 3, maxRetries: 2, timeoutMs: 20000, isAvailable: true },
    ];

    const mockGenerateFn = async (_pid: string, model: string) => ({
        content: `Response from ${model}`,
        usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    });

    beforeEach(() => {
        dispatcher = new ProviderDispatcher();
        dispatcher.configureRoutes(mockRoutes);
    });

    it('configures routes sorted by priority', () => {
        expect(dispatcher.routeCount).toBe(3);
    });

    it('dispatches to highest priority provider', async () => {
        const result = await dispatcher.dispatch(
            [{ role: 'user', content: 'hello' }],
            {},
            mockGenerateFn,
        );
        expect(result.providerId).toBe('openai');
        expect(result.response).toContain('gpt-4o');
        expect(result.fromFallback).toBe(false);
    });

    it('falls back to next provider on failure', async () => {
        let callCount = 0;
        const failFirstFn = async (pid: string, model: string) => {
            callCount++;
            if (callCount === 1) throw new Error('openai error');
            return { content: `Fallback ${model}`, usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } };
        };
        const result = await dispatcher.dispatch(
            [{ role: 'user', content: 'test' }],
            {},
            failFirstFn,
        );
        expect(result.providerId).toBe('anthropic');
        expect(result.fromFallback).toBe(true);
    });

    it('dispatches to preferred model', async () => {
        const result = await dispatcher.dispatch(
            [{ role: 'user', content: 'test' }],
            { model: 'claude-sonnet-4-20250514' },
            mockGenerateFn,
        );
        expect(result.model).toBe('claude-sonnet-4-20250514');
    });

    it('throws when all providers fail', async () => {
        const failAll = async () => { throw new Error('fail'); };
        await expect(
            dispatcher.dispatch([{ role: 'user', content: 'x' }], {}, failAll),
        ).rejects.toThrow('fail');
    });

    it('throws when no providers available', async () => {
        dispatcher.configureRoutes([
            { providerId: 'x', model: 'x', priority: 1, maxRetries: 1, timeoutMs: 1000, isAvailable: false },
        ]);
        await expect(
            dispatcher.dispatch([{ role: 'user', content: 'x' }], {}, mockGenerateFn),
        ).rejects.toThrow('No providers available');
    });

    it('tracks latency in health report', async () => {
        await dispatcher.dispatch([{ role: 'user', content: 'x' }], {}, mockGenerateFn);
        const health = dispatcher.getHealthReport();
        const openai = health.find(h => h.providerId === 'openai');
        expect(openai!.isHealthy).toBe(true);
        expect(openai!.avgLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('marks provider unhealthy after 3 errors', async () => {
        let callCount = 0;
        const alwaysFail = async (pid: string, model: string) => {
            callCount++;
            if (pid === 'openai') throw new Error('fail');
            return { content: 'ok', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
        };
        // Call 3 times — each time openai fails, then fallback succeeds
        for (let i = 0; i < 3; i++) {
            await dispatcher.dispatch([{ role: 'user', content: 'x' }], {}, alwaysFail);
        }
        const health = dispatcher.getHealthReport();
        const openai = health.find(h => h.providerId === 'openai');
        expect(openai!.isHealthy).toBe(false);
        expect(openai!.errorCount).toBe(3);
    });

    it('resolveDispatchOrder excludes unhealthy providers', async () => {
        // Force openai unhealthy
        const h = dispatcher.getHealthReport().find(h => h.providerId === 'openai');
        // Simulate 3 errors directly
        let failCount = 0;
        const failOpenai = async (pid: string, model: string) => {
            if (pid === 'openai') { throw new Error('fail'); }
            return { content: 'ok', usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
        };
        for (let i = 0; i < 3; i++) {
            await dispatcher.dispatch([{ role: 'user', content: 'x' }], {}, failOpenai);
        }
        const order = dispatcher.resolveDispatchOrder();
        expect(order.map(r => r.providerId)).not.toContain('openai');
    });

    it('tokens usage is correctly mapped', async () => {
        const result = await dispatcher.dispatch(
            [{ role: 'user', content: 'test' }],
            {},
            mockGenerateFn,
        );
        expect(result.tokensUsed.prompt).toBe(100);
        expect(result.tokensUsed.completion).toBe(50);
        expect(result.tokensUsed.total).toBe(150);
    });
});
