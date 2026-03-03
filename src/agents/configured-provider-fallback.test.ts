import { describe, it, expect } from 'vitest';
import { resolveConfiguredProviderFallback } from './configured-provider-fallback.js';

describe('resolveConfiguredProviderFallback', () => {
    it('returns null when no providers configured', () => {
        expect(resolveConfiguredProviderFallback({
            cfg: { models: {} } as any,
            defaultProvider: 'anthropic',
        })).toBeNull();
    });

    it('returns null when default provider is already configured', () => {
        expect(resolveConfiguredProviderFallback({
            cfg: {
                models: {
                    providers: {
                        anthropic: { models: [{ id: 'claude' }] },
                    },
                },
            } as any,
            defaultProvider: 'anthropic',
        })).toBeNull();
    });

    it('returns first available provider when default not configured', () => {
        const result = resolveConfiguredProviderFallback({
            cfg: {
                models: {
                    providers: {
                        openai: { models: [{ id: 'gpt-4o' }] },
                    },
                },
            } as any,
            defaultProvider: 'anthropic',
        });
        expect(result).not.toBeNull();
        expect(result!.provider).toBe('openai');
        expect(result!.model).toBe('gpt-4o');
    });

    it('returns null when no provider has models', () => {
        expect(resolveConfiguredProviderFallback({
            cfg: {
                models: {
                    providers: {
                        openai: { models: [] },
                    },
                },
            } as any,
            defaultProvider: 'anthropic',
        })).toBeNull();
    });
});
