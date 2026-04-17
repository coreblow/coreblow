/**
 * agents/provider-id.test.ts
 */
import { describe, it, expect } from 'vitest';
import { normalizeProviderId, normalizeProviderIdForAuth, findNormalizedProviderKey, parseModelRef, buildModelRef, listKnownProviders, isKnownProvider } from './provider-id.js';

describe('Provider ID', () => {
    describe('normalizeProviderId', () => {
        it('normalizes aliases', () => {
            expect(normalizeProviderId('oai')).toBe('openai');
            expect(normalizeProviderId('claude')).toBe('anthropic');
            expect(normalizeProviderId('gemini')).toBe('google');
            expect(normalizeProviderId('grok')).toBe('xai');
            expect(normalizeProviderId('local')).toBe('ollama');
        });
        it('handles case and whitespace', () => {
            expect(normalizeProviderId('  OpenAI  ')).toBe('openai');
            expect(normalizeProviderId('ANTHROPIC')).toBe('anthropic');
        });
        it('passes through unknown', () => {
            expect(normalizeProviderId('custom-provider')).toBe('customprovider');
        });
    });

    describe('normalizeProviderIdForAuth', () => {
        it('maps vertex to google', () => expect(normalizeProviderIdForAuth('vertex')).toBe('google'));
        it('keeps others', () => expect(normalizeProviderIdForAuth('openai')).toBe('openai'));
    });

    describe('findNormalizedProviderKey', () => {
        it('finds key', () => {
            const map = { 'OpenAI': 'key1', 'Anthropic': 'key2' };
            expect(findNormalizedProviderKey(map, 'oai')).toBe('OpenAI');
        });
        it('returns undefined for missing', () => {
            expect(findNormalizedProviderKey({ x: 1 }, 'openai')).toBeUndefined();
        });
    });

    describe('parseModelRef', () => {
        it('parses provider/model', () => {
            const ref = parseModelRef('openai/gpt-4o');
            expect(ref).toEqual({ provider: 'openai', model: 'gpt-4o' });
        });
        it('normalizes provider', () => {
            expect(parseModelRef('oai/gpt-4')!.provider).toBe('openai');
        });
        it('returns null for no separator', () => {
            expect(parseModelRef('gpt-4o')).toBeNull();
        });
    });

    describe('buildModelRef', () => {
        it('builds ref', () => expect(buildModelRef('oai', 'gpt-4o')).toBe('openai/gpt-4o'));
    });

    describe('listKnownProviders', () => {
        it('returns sorted providers', () => {
            const providers = listKnownProviders();
            expect(providers).toContain('openai');
            expect(providers).toContain('anthropic');
            expect(providers.length).toBeGreaterThan(5);
        });
    });

    describe('isKnownProvider', () => {
        it('known', () => expect(isKnownProvider('openai')).toBe(true));
        it('alias', () => expect(isKnownProvider('grok')).toBe(true));
        it('unknown', () => expect(isKnownProvider('randomxyz')).toBe(false));
    });
});
