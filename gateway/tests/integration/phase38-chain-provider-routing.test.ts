/**
 * CoreBlow Phase 38 — Provider Routing & Failover Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   ProviderRegistry.register → route → failover → response
 */
import { describe, it, expect } from 'vitest';
import { ProviderRegistry } from '../../src/providers/provider-registry.js';
import { ResponseBuilder } from '../../src/gateway/response-builder.js';
import type { ModelProvider } from '../../src/agents/runtime.js';

const mockProvider = (id: string): ModelProvider => ({
    id, name: id,
    generateText: async () => ({ text: `response from ${id}`, usage: { input: 10, output: 20 } }),
    generateStream: async function* () {},
});

describe('Phase38 Chain: Provider Routing & Failover Pipeline', () => {

    it('register providers → route model → get response', async () => {
        const reg = new ProviderRegistry();
        reg.register(mockProvider('openai'), ['gpt-4o'], 10);
        reg.register(mockProvider('anthropic'), ['claude-sonnet-4-20250514'], 10);

        // Route to correct provider
        const route = reg.route('gpt-4o');
        expect(route?.provider.id).toBe('openai');

        // Generate response
        const result = await route!.provider.generateText!({ model: 'gpt-4o', messages: [] } as any);
        const response = ResponseBuilder.ok({ text: result.text, usage: result.usage });
        expect(response.status).toBe(200);
        expect((response.body as any).text).toContain('openai');
    });

    it('primary unhealthy → failover to secondary', () => {
        const reg = new ProviderRegistry();
        reg.register(mockProvider('primary'), ['shared-model'], 10);
        reg.register(mockProvider('secondary'), ['shared-model'], 5);

        // Mark primary unhealthy
        reg.setHealthy('primary', false);

        const route = reg.route('shared-model');
        expect(route?.provider.id).toBe('secondary');
    });

    it('all providers down → return error response', () => {
        const reg = new ProviderRegistry();
        reg.register(mockProvider('only-provider'), ['model-x']);
        reg.setHealthy('only-provider', false);

        const route = reg.route('model-x');
        // Default provider is unhealthy, so should be null
        expect(route).toBeNull();

        const response = ResponseBuilder.error('No healthy providers available', 503);
        expect(response.status).toBe(503);
    });
});
