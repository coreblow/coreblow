/**
 * CoreBlow Phase 38 — ProviderRegistry Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Register, route, enable/disable, health, fallbacks
 *   - Model indexing, default provider, prefix matching
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from '../../src/providers/provider-registry.js';
import type { ModelProvider } from '../../src/agents/runtime.js';

const mockProvider = (id: string, name?: string): ModelProvider => ({
    id, name: name ?? id,
    generateText: async () => ({ text: '', usage: { input: 0, output: 0 } }),
    generateStream: async function* () {},
});

describe('ProviderRegistry — Extended', () => {
    let reg: ProviderRegistry;
    beforeEach(() => { reg = new ProviderRegistry(); });

    it('should register and retrieve provider', () => {
        reg.register(mockProvider('openai', 'OpenAI'), ['gpt-4o', 'gpt-3.5-turbo']);
        expect(reg.get('openai')).not.toBeNull();
        expect(reg.get('openai')?.name).toBe('OpenAI');
    });

    it('should route model to correct provider', () => {
        reg.register(mockProvider('openai'), ['gpt-4o']);
        reg.register(mockProvider('anthropic'), ['claude-sonnet-4-20250514']);

        const route = reg.route('gpt-4o');
        expect(route?.provider.id).toBe('openai');

        const route2 = reg.route('claude-sonnet-4-20250514');
        expect(route2?.provider.id).toBe('anthropic');
    });

    it('should provide fallbacks when multiple providers support same model', () => {
        reg.register(mockProvider('primary'), ['gpt-4o'], 10);
        reg.register(mockProvider('secondary'), ['gpt-4o'], 5);

        const route = reg.route('gpt-4o');
        expect(route?.provider.id).toBe('primary');
        expect(route?.fallbacks).toHaveLength(1);
        expect(route?.fallbacks[0]?.id).toBe('secondary');
    });

    it('should skip disabled providers', () => {
        reg.register(mockProvider('disabled-provider'), ['model-a'], 10);
        reg.register(mockProvider('active-provider'), ['model-a'], 5);
        reg.setEnabled('disabled-provider', false);

        const route = reg.route('model-a');
        expect(route?.provider.id).toBe('active-provider');
    });

    it('should skip unhealthy providers', () => {
        reg.register(mockProvider('sick'), ['model-b'], 10);
        reg.register(mockProvider('healthy'), ['model-b'], 5);
        reg.setHealthy('sick', false);

        const route = reg.route('model-b');
        expect(route?.provider.id).toBe('healthy');
    });

    it('should fall back to default provider for unknown models', () => {
        reg.register(mockProvider('default-provider'), ['gpt-4o']);
        const route = reg.route('completely-unknown-model');
        expect(route?.provider.id).toBe('default-provider');
    });

    it('should return null when no providers available', () => {
        expect(reg.route('anything')).toBeNull();
    });

    it('should set custom default provider', () => {
        reg.register(mockProvider('first'), ['m1']);
        reg.register(mockProvider('second'), ['m2']);
        reg.setDefault('second');

        const route = reg.route('unknown');
        expect(route?.provider.id).toBe('second');
    });

    it('should list all providers', () => {
        reg.register(mockProvider('a'), ['m1'], 10);
        reg.register(mockProvider('b'), ['m2'], 5);
        const list = reg.list();
        expect(list).toHaveLength(2);
    });

    it('should list all models', () => {
        reg.register(mockProvider('p1'), ['gpt-4o', 'gpt-3.5']);
        reg.register(mockProvider('p2'), ['claude-sonnet-4-20250514']);
        const models = reg.listModels();
        expect(models).toHaveLength(3);
    });

    it('should return false for unknown provider operations', () => {
        expect(reg.setEnabled('ghost', true)).toBe(false);
        expect(reg.setHealthy('ghost', true)).toBe(false);
        expect(reg.setDefault('ghost')).toBe(false);
    });
});
