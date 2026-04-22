/**
 * CoreBlow — Provider Registry Tests
 *
 * Tests for AI provider registration, model routing (direct, prefix, default),
 * health/enable toggling, and provider listing.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry } from './provider-registry.js';
import type { ModelProvider } from '../agents/runtime.js';

function makeProvider(id: string, name?: string): ModelProvider {
    return { id, name: name ?? id } as ModelProvider;
}

describe('ProviderRegistry', () => {
    let registry: ProviderRegistry;

    beforeEach(() => {
        registry = new ProviderRegistry();
    });

    // === Registration ===

    describe('register', () => {
        it('registers a provider with models', () => {
            const p = makeProvider('openai');
            registry.register(p, ['gpt-4o', 'gpt-4o-mini'], 10);

            expect(registry.get('openai')).toBe(p);
            expect(registry.list()).toHaveLength(1);
            expect(registry.list()[0]!.models).toEqual(['gpt-4o', 'gpt-4o-mini']);
        });

        it('sets the first registered provider as default', () => {
            registry.register(makeProvider('first'), ['model-a']);
            registry.register(makeProvider('second'), ['model-b']);

            // model-x doesn't exist, so it should fall back to default (first)
            const route = registry.route('unknown-model');
            expect(route?.provider.id).toBe('first');
        });

        it('indexes models for routing', () => {
            registry.register(makeProvider('openai'), ['gpt-4o']);
            const models = registry.listModels();
            expect(models).toEqual([{ model: 'gpt-4o', providers: ['openai'] }]);
        });
    });

    // === Routing ===

    describe('route', () => {
        it('routes to exact model match', () => {
            registry.register(makeProvider('openai'), ['gpt-4o'], 10);
            registry.register(makeProvider('anthropic'), ['claude-3-opus'], 5);

            const route = registry.route('gpt-4o');
            expect(route?.provider.id).toBe('openai');
            expect(route?.model).toBe('gpt-4o');
        });

        it('picks highest priority when multiple providers serve same model', () => {
            registry.register(makeProvider('low'), ['shared-model'], 1);
            registry.register(makeProvider('high'), ['shared-model'], 10);

            const route = registry.route('shared-model');
            expect(route?.provider.id).toBe('high');
            expect(route?.fallbacks).toHaveLength(1);
            expect(route?.fallbacks[0]!.id).toBe('low');
        });

        it('skips disabled providers', () => {
            registry.register(makeProvider('disabled'), ['model-a'], 10);
            registry.register(makeProvider('enabled'), ['model-a'], 5);
            registry.setEnabled('disabled', false);

            const route = registry.route('model-a');
            expect(route?.provider.id).toBe('enabled');
        });

        it('skips unhealthy providers', () => {
            registry.register(makeProvider('sick'), ['model-a'], 10);
            registry.register(makeProvider('healthy'), ['model-a'], 5);
            registry.setHealthy('sick', false);

            const route = registry.route('model-a');
            expect(route?.provider.id).toBe('healthy');
        });

        it('falls back to default provider for unknown model', () => {
            registry.register(makeProvider('default'), ['known-model']);
            const route = registry.route('totally-unknown');
            expect(route?.provider.id).toBe('default');
        });

        it('returns null when no providers available', () => {
            expect(registry.route('anything')).toBeNull();
        });

        it('returns null when all providers disabled', () => {
            registry.register(makeProvider('only'), ['model']);
            registry.setEnabled('only', false);
            // Default also disabled — should return null for unknown
            const route = registry.route('unknown');
            expect(route).toBeNull();
        });
    });

    // === Enable / Disable / Health ===

    describe('setEnabled', () => {
        it('returns false for non-existent provider', () => {
            expect(registry.setEnabled('ghost', true)).toBe(false);
        });
    });

    describe('setHealthy', () => {
        it('marks a provider as unhealthy', () => {
            registry.register(makeProvider('p1'), ['m1']);
            expect(registry.setHealthy('p1', false)).toBe(true);

            const info = registry.list().find((p) => p.id === 'p1');
            expect(info?.healthy).toBe(false);
        });

        it('returns false for non-existent provider', () => {
            expect(registry.setHealthy('ghost', false)).toBe(false);
        });
    });

    // === Listing ===

    describe('list', () => {
        it('returns all providers with metadata', () => {
            registry.register(makeProvider('a', 'Provider A'), ['model-1'], 5);
            const list = registry.list();
            expect(list[0]).toEqual({
                id: 'a', name: 'Provider A', models: ['model-1'],
                enabled: true, healthy: true, priority: 5,
            });
        });
    });

    describe('listModels', () => {
        it('lists all models across providers', () => {
            registry.register(makeProvider('p1'), ['m1', 'm2']);
            registry.register(makeProvider('p2'), ['m3']);

            const models = registry.listModels();
            expect(models).toHaveLength(3);
        });

        it('shows shared models with multiple providers', () => {
            registry.register(makeProvider('p1'), ['shared']);
            registry.register(makeProvider('p2'), ['shared']);

            const models = registry.listModels();
            expect(models.find((m) => m.model === 'shared')?.providers).toEqual(['p1', 'p2']);
        });
    });

    // === Default ===

    describe('setDefault', () => {
        it('changes the default provider', () => {
            registry.register(makeProvider('a'), ['m1']);
            registry.register(makeProvider('b'), ['m2']);
            registry.setDefault('b');

            const route = registry.route('unknown-model');
            expect(route?.provider.id).toBe('b');
        });

        it('returns false for non-existent provider', () => {
            expect(registry.setDefault('ghost')).toBe(false);
        });
    });
});
