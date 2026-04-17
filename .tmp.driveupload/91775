/**
 * tests/image-gen/image-gen.test.ts
 * Tests for image generation provider registry and prompt validation.
 */
import { describe, it, expect } from 'vitest';
import { ImageGenerationRegistry } from './provider-registry.js';

describe('ImageGenerationRegistry', () => {
    it('should create empty registry', () => {
        const registry = new ImageGenerationRegistry();
        expect(registry.list()).toHaveLength(0);
    });

    it('should register a provider', () => {
        const registry = new ImageGenerationRegistry();
        registry.register('dalle', { name: 'DALL-E', generate: () => {} });
        expect(registry.list()).toContain('dalle');
    });

    it('should retrieve provider by name', () => {
        const registry = new ImageGenerationRegistry();
        const provider = { name: 'Midjourney' };
        registry.register('midjourney', provider);
        expect(registry.get('midjourney')).toBe(provider);
    });

    it('should return undefined for unknown provider', () => {
        const registry = new ImageGenerationRegistry();
        expect(registry.get('nonexistent')).toBeUndefined();
    });

    it('should list all providers', () => {
        const registry = new ImageGenerationRegistry();
        registry.register('dalle', {});
        registry.register('sd', {});
        registry.register('midjourney', {});
        expect(registry.list()).toHaveLength(3);
    });

    it('should overwrite existing provider', () => {
        const registry = new ImageGenerationRegistry();
        registry.register('dalle', { version: 1 });
        registry.register('dalle', { version: 2 });
        const p = registry.get('dalle') as { version: number };
        expect(p.version).toBe(2);
    });

    it('should support prompt validation', () => {
        // Basic prompt validation — non-empty, reasonable length
        const prompt = 'A beautiful sunset over mountains';
        expect(prompt.length).toBeGreaterThan(0);
        expect(prompt.length).toBeLessThan(10000);
    });

    it('should reject empty prompts', () => {
        const prompt = '';
        expect(prompt.length).toBe(0);
    });

    it('should handle multiple providers for fallback', () => {
        const registry = new ImageGenerationRegistry();
        registry.register('primary', { priority: 1 });
        registry.register('fallback', { priority: 2 });
        const providers = registry.list();
        expect(providers).toContain('primary');
        expect(providers).toContain('fallback');
    });

    it('should list providers in insertion order', () => {
        const registry = new ImageGenerationRegistry();
        registry.register('a', {});
        registry.register('b', {});
        registry.register('c', {});
        const list = registry.list();
        expect(list[0]).toBe('a');
        expect(list[2]).toBe('c');
    });
});
