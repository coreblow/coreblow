/**
 * Provider Tests — Phase A: Core Safety
 * Tests: ProviderRegistry, FallbackProvider
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from './provider-registry.js';
import { FallbackProvider } from './fallback.js';
import type { AIProvider, ChatMessage, ProviderOptions, StreamChunk } from './interface.js';

// ═══════════════════════════════════════════════════════════════════
// Mock Providers
// ═══════════════════════════════════════════════════════════════════

function createMockProvider(name: string, models: string[], opts?: { fail?: boolean; delay?: number }): any {
    return {
        id: name, name,
        async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
            if (opts?.fail) throw new Error(`${name} failed`);
            if (opts?.delay) await new Promise(r => setTimeout(r, opts.delay));
            yield { type: 'text', content: `Response from ${name}` };
            yield { type: 'done' };
        },
        async isAvailable() { return !opts?.fail; },
        async listModels() { return models; },
    };
}

// ═══════════════════════════════════════════════════════════════════
// ProviderRegistry
// ═══════════════════════════════════════════════════════════════════

describe('ProviderRegistry', () => {
    let registry: ProviderRegistry;

    beforeEach(() => { registry = new ProviderRegistry(); });

    // --- Registration ---
    it('registers a provider', () => {
        const p = createMockProvider('openai', ['gpt-4o', 'gpt-4o-mini']);
        registry.register(p, ['gpt-4o', 'gpt-4o-mini'], 10);
        expect(registry.list()).toHaveLength(1);
        expect(registry.list()[0].id).toBe('openai');
    });

    it('registers multiple providers', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o'], 10);
        registry.register(createMockProvider('anthropic', ['claude-3']), ['claude-3'], 5);
        expect(registry.list()).toHaveLength(2);
    });

    it('indexes models', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o'], 10);
        const models = registry.listModels();
        expect(models.some(m => m.model === 'gpt-4o')).toBe(true);
    });

    it('sets first registered as default', () => {
        const p = createMockProvider('openai', ['gpt-4o']);
        registry.register(p, ['gpt-4o']);
        // Any unknown model should route to default
        expect(registry.route('unknown-model')).not.toBeNull();
    });

    // --- Routing ---
    it('routes model to correct provider', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o'], 10);
        registry.register(createMockProvider('anthropic', ['claude-3']), ['claude-3'], 5);
        expect(registry.route('gpt-4o')!.provider.id).toBe('openai');
        expect(registry.route('claude-3')!.provider.id).toBe('anthropic');
    });

    it('routes by prefix match', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o'], 10);
        // "gpt-4o-2024" should prefix-match "gpt" from "gpt-4o"
        const route = registry.route('gpt-4o-2024');
        expect(route).not.toBeNull();
    });

    it('returns null when no provider available', () => {
        expect(registry.route('gpt-4o')).toBeNull();
    });

    it('picks highest priority provider', () => {
        registry.register(createMockProvider('cheap', ['gpt-4o']), ['gpt-4o'], 1);
        registry.register(createMockProvider('premium', ['gpt-4o']), ['gpt-4o'], 100);
        expect(registry.route('gpt-4o')!.provider.id).toBe('premium');
    });

    it('provides fallbacks', () => {
        registry.register(createMockProvider('primary', ['gpt-4o']), ['gpt-4o'], 100);
        registry.register(createMockProvider('secondary', ['gpt-4o']), ['gpt-4o'], 50);
        const route = registry.route('gpt-4o')!;
        expect(route.provider.id).toBe('primary');
        expect(route.fallbacks).toHaveLength(1);
    });

    it('routes to default when model unknown', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o']);
        const route = registry.route('totally-unknown-model');
        expect(route).not.toBeNull();
    });

    // --- Enable/Disable ---
    it('disables provider', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o'], 10);
        registry.register(createMockProvider('anthropic', ['gpt-4o']), ['gpt-4o'], 5);
        registry.setEnabled('openai', false);
        expect(registry.route('gpt-4o')!.provider.id).toBe('anthropic');
    });

    it('re-enables provider', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o'], 10);
        registry.setEnabled('openai', false);
        registry.setEnabled('openai', true);
        expect(registry.route('gpt-4o')!.provider.id).toBe('openai');
    });

    it('returns false enabling non-existent', () => {
        expect(registry.setEnabled('nonexistent', true)).toBe(false);
    });

    // --- Health ---
    it('marks provider unhealthy', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o'], 10);
        registry.register(createMockProvider('anthropic', ['gpt-4o']), ['gpt-4o'], 5);
        registry.setHealthy('openai', false);
        expect(registry.route('gpt-4o')!.provider.id).toBe('anthropic');
    });

    it('marks provider healthy again', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o'], 10);
        registry.setHealthy('openai', false);
        registry.setHealthy('openai', true);
        expect(registry.route('gpt-4o')!.provider.id).toBe('openai');
    });

    // --- Get ---
    it('gets provider by ID', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o']);
        expect(registry.get('openai')).not.toBeNull();
        expect(registry.get('openai')!.id).toBe('openai');
    });

    it('returns null for unknown provider', () => {
        expect(registry.get('nonexistent')).toBeNull();
    });

    // --- Set Default ---
    it('changes default provider', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o']);
        registry.register(createMockProvider('anthropic', ['claude']), ['claude']);
        expect(registry.setDefault('anthropic')).toBe(true);
    });

    it('returns false setting non-existent default', () => {
        expect(registry.setDefault('nonexistent')).toBe(false);
    });

    // --- List Models ---
    it('lists all models', () => {
        registry.register(createMockProvider('openai', ['gpt-4o', 'gpt-4o-mini']), ['gpt-4o', 'gpt-4o-mini']);
        registry.register(createMockProvider('anthropic', ['claude-3']), ['claude-3']);
        const models = registry.listModels();
        expect(models).toHaveLength(3);
    });

    // --- Edge Cases ---
    it('handles all providers disabled', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o']);
        registry.setEnabled('openai', false);
        expect(registry.route('gpt-4o')).toBeNull();
    });

    it('handles all providers unhealthy', () => {
        registry.register(createMockProvider('openai', ['gpt-4o']), ['gpt-4o']);
        registry.setHealthy('openai', false);
        expect(registry.route('gpt-4o')).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════
// FallbackProvider
// ═══════════════════════════════════════════════════════════════════

describe('FallbackProvider', () => {
    function createAIProvider(name: string, opts?: { fail?: boolean }): AIProvider {
        return {
            name,
            async *chat(messages: ChatMessage[], options: ProviderOptions): AsyncIterable<StreamChunk> {
                if (opts?.fail) throw new Error(`${name} down`);
                yield { type: 'text', content: `${name}: ok` } as any;
            },
            async isAvailable() { return !opts?.fail; },
            async listModels() { return [`${name}-model`]; },
        };
    }

    it('uses first healthy provider', async () => {
        const fb = new FallbackProvider([
            createAIProvider('primary'),
            createAIProvider('secondary'),
        ]);
        const chunks: any[] = [];
        for await (const chunk of fb.chat([], {} as any)) chunks.push(chunk);
        expect(chunks.some(c => c.content?.includes('primary'))).toBe(true);
    });

    it('falls back to second on first failure', async () => {
        const fb = new FallbackProvider([
            createAIProvider('primary', { fail: true }),
            createAIProvider('secondary'),
        ]);
        const chunks: any[] = [];
        for await (const chunk of fb.chat([], {} as any)) chunks.push(chunk);
        expect(chunks.some(c => c.content?.includes('secondary'))).toBe(true);
    });

    it('returns error when all providers fail', async () => {
        const fb = new FallbackProvider([
            createAIProvider('p1', { fail: true }),
            createAIProvider('p2', { fail: true }),
        ]);
        const chunks: any[] = [];
        for await (const chunk of fb.chat([], {} as any)) chunks.push(chunk);
        expect(chunks.some(c => c.type === 'error')).toBe(true);
    });

    // --- Health Status ---
    it('tracks health status', async () => {
        const fb = new FallbackProvider([createAIProvider('p1'), createAIProvider('p2')]);
        for await (const _ of fb.chat([], {} as any)) {} // trigger one call
        const status = fb.getHealthStatus();
        expect(status[0].totalSuccess).toBe(1);
    });

    it('tracks failure count on provider', async () => {
        const fb = new FallbackProvider([
            createAIProvider('p1', { fail: true }),
            createAIProvider('p2'),
        ]);
        for await (const _ of fb.chat([], {} as any)) {}
        const status = fb.getHealthStatus();
        expect(status[0].totalErrors).toBeGreaterThanOrEqual(1);
    });

    // --- Reset ---
    it('resets all health states', async () => {
        const fb = new FallbackProvider([
            createAIProvider('p1', { fail: true }),
            createAIProvider('p2'),
        ]);
        for await (const _ of fb.chat([], {} as any)) {}
        fb.resetAll();
        const status = fb.getHealthStatus();
        expect(status.every(p => p.healthy)).toBe(true);
    });

    // --- Availability ---
    it('reports available if any provider up', async () => {
        const fb = new FallbackProvider([
            createAIProvider('p1', { fail: true }),
            createAIProvider('p2'),
        ]);
        expect(await fb.isAvailable()).toBe(true);
    });

    it('reports unavailable if all down', async () => {
        const fb = new FallbackProvider([
            createAIProvider('p1', { fail: true }),
            createAIProvider('p2', { fail: true }),
        ]);
        expect(await fb.isAvailable()).toBe(false);
    });

    // --- List Models ---
    it('lists models from all providers', async () => {
        const fb = new FallbackProvider([createAIProvider('p1'), createAIProvider('p2')]);
        const models = await fb.listModels();
        expect(models).toHaveLength(2);
        expect(models[0]).toContain('p1');
        expect(models[1]).toContain('p2');
    });
});
