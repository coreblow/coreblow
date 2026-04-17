/**
 * agents/model-catalog.test.ts
 */
import { describe, it, expect } from 'vitest';
import { ModelCatalog } from './model-catalog.js';

describe('Model Catalog', () => {
    it('has builtin models', () => {
        const catalog = new ModelCatalog();
        expect(catalog.size()).toBeGreaterThan(5);
    });

    it('gets model by id', () => {
        const catalog = new ModelCatalog();
        const model = catalog.get('gpt-4o');
        expect(model).toBeDefined();
        expect(model!.provider).toBe('openai');
        expect(model!.supportsTools).toBe(true);
    });

    it('lists by provider', () => {
        const catalog = new ModelCatalog();
        const anthropic = catalog.listByProvider('anthropic');
        expect(anthropic.length).toBeGreaterThan(0);
        expect(anthropic.every((m) => m.provider === 'anthropic')).toBe(true);
    });

    it('lists by tag', () => {
        const catalog = new ModelCatalog();
        const flagship = catalog.listByTag('flagship');
        expect(flagship.length).toBeGreaterThan(0);
    });

    it('finds by capability', () => {
        const catalog = new ModelCatalog();
        const thinking = catalog.findByCapability({ thinking: true });
        expect(thinking.length).toBeGreaterThan(0);
        expect(thinking.every((m) => m.supportsThinking)).toBe(true);
    });

    it('resolves context window', () => {
        const catalog = new ModelCatalog();
        expect(catalog.resolveContextWindow('gemini-2.5-pro')).toBe(1_048_576);
        expect(catalog.resolveContextWindow('unknown-model')).toBe(128_000);
    });

    it('estimates cost', () => {
        const catalog = new ModelCatalog();
        const cost = catalog.estimateCost('gpt-4o', 10_000, 5_000);
        expect(cost).not.toBeNull();
        expect(cost!).toBeGreaterThan(0);
    });

    it('returns null cost for unknown', () => {
        const catalog = new ModelCatalog();
        expect(catalog.estimateCost('unknown', 1000, 500)).toBeNull();
    });

    it('adds custom model', () => {
        const catalog = new ModelCatalog();
        catalog.add({ id: 'custom-1', provider: 'custom', displayName: 'Custom', contextWindow: 8192, supportsTools: false, supportsVision: false, supportsStreaming: false });
        expect(catalog.get('custom-1')).toBeDefined();
    });

    it('removes model', () => {
        const catalog = new ModelCatalog();
        expect(catalog.remove('gpt-4o')).toBe(true);
        expect(catalog.get('gpt-4o')).toBeUndefined();
    });

    it('lists providers', () => {
        const catalog = new ModelCatalog();
        const providers = catalog.providers();
        expect(providers).toContain('openai');
        expect(providers).toContain('anthropic');
        expect(providers).toContain('google');
    });
});
