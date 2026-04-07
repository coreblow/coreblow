import { describe, it, expect } from 'vitest';
import { parseImageGenerationModelRef } from './model-ref.js';
import { ImageGenerationRegistry } from './provider-registry.js';
import type { ImageGenerationRequest, ImageGenerationCapabilities } from './types.js';

describe('Image Generation Module', () => {
    describe('model-ref.ts: parseImageGenerationModelRef', () => {
        it('parses valid provider/model reference', () => {
            const ref = parseImageGenerationModelRef('openai/dall-e-3');
            expect(ref).not.toBeNull();
            expect(ref!.provider).toBe('openai');
            expect(ref!.model).toBe('dall-e-3');
        });

        it('parses with extra whitespace', () => {
            const ref = parseImageGenerationModelRef('  google / imagen-3  ');
            expect(ref).not.toBeNull();
            expect(ref!.provider).toBe('google');
            expect(ref!.model).toBe('imagen-3');
        });

        it('returns null for undefined/empty', () => {
            expect(parseImageGenerationModelRef(undefined)).toBeNull();
            expect(parseImageGenerationModelRef('')).toBeNull();
            expect(parseImageGenerationModelRef('   ')).toBeNull();
        });

        it('returns null for missing provider or model', () => {
            expect(parseImageGenerationModelRef('/dall-e-3')).toBeNull();  // no provider
            expect(parseImageGenerationModelRef('openai/')).toBeNull();   // no model
            expect(parseImageGenerationModelRef('just-a-model')).toBeNull(); // no slash
        });
    });

    describe('provider-registry.ts: ImageGenerationRegistry', () => {
        it('registers and retrieves providers', () => {
            const registry = new ImageGenerationRegistry();
            const mockProvider = { id: 'test', name: 'Test Provider' };

            registry.register('test', mockProvider);
            expect(registry.get('test')).toBe(mockProvider);
        });

        it('lists registered providers', () => {
            const registry = new ImageGenerationRegistry();
            registry.register('openai', { id: 'openai' });
            registry.register('google', { id: 'google' });

            const list = registry.list();
            expect(list).toContain('openai');
            expect(list).toContain('google');
            expect(list.length).toBe(2);
        });

        it('returns undefined for unregistered provider', () => {
            const registry = new ImageGenerationRegistry();
            expect(registry.get('nonexistent')).toBeUndefined();
        });

        it('overwrites existing provider', () => {
            const registry = new ImageGenerationRegistry();
            registry.register('a', { version: 1 });
            registry.register('a', { version: 2 });
            expect((registry.get('a') as any).version).toBe(2);
        });
    });

    describe('types.ts: type validation (structural)', () => {
        it('ImageGenerationRequest satisfies interface shape', () => {
            const request: ImageGenerationRequest = {
                prompt: 'A cat in space',
                provider: 'openai',
                model: 'dall-e-3',
                size: '1024x1024',
                count: 1,
                quality: 'hd',
                style: 'vivid',
            };
            expect(request.prompt).toBe('A cat in space');
            expect(request.quality).toBe('hd');
        });

        it('ImageGenerationCapabilities validates all fields', () => {
            const caps: ImageGenerationCapabilities = {
                generate: true,
                edit: false,
                sizes: ['1024x1024', '1792x1024'],
                aspectRatios: ['1:1', '16:9'],
                maxCount: 4,
                negativePrompt: true,
                styles: ['natural', 'vivid'],
                qualities: ['standard', 'hd'],
            };
            expect(caps.generate).toBe(true);
            expect(caps.sizes).toContain('1024x1024');
            expect(caps.maxCount).toBe(4);
        });
    });
});
