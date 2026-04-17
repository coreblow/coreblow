/**
 * Tests for CoreBlow Model Authentication Engine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    registerAuthProfile,
    getAuthProfile,
    listAuthProfiles,
    removeAuthProfile,
    clearAuthProfiles,
    resolveAuth,
    resolveEnvApiKey,
    getDefaultBaseUrl,
    hasCredentials,
    validateAuth,
    maskApiKey,
    isApiKeyMasked,
    discoverConfiguredProviders,
    type AuthProfile,
} from './model-auth.js';

describe('Auth Profile Registry', () => {
    beforeEach(() => clearAuthProfiles());

    it('should register and retrieve profiles', () => {
        const profile: AuthProfile = {
            id: 'default',
            provider: 'openai',
            apiKey: 'sk-test-key-123456789',
        };
        registerAuthProfile(profile);
        expect(getAuthProfile('openai', 'default')).toEqual(profile);
    });

    it('should normalize provider IDs', () => {
        registerAuthProfile({ id: 'p1', provider: 'gpt', apiKey: 'sk-test' });
        expect(getAuthProfile('openai', 'p1')).toBeDefined();
    });

    it('should list profiles by provider', () => {
        registerAuthProfile({ id: 'p1', provider: 'openai', apiKey: 'sk-1' });
        registerAuthProfile({ id: 'p2', provider: 'openai', apiKey: 'sk-2' });
        registerAuthProfile({ id: 'p3', provider: 'anthropic', apiKey: 'sk-ant-1' });

        expect(listAuthProfiles('openai')).toHaveLength(2);
        expect(listAuthProfiles('anthropic')).toHaveLength(1);
        expect(listAuthProfiles()).toHaveLength(3);
    });

    it('should remove profiles', () => {
        registerAuthProfile({ id: 'p1', provider: 'openai', apiKey: 'sk-1' });
        expect(removeAuthProfile('openai', 'p1')).toBe(true);
        expect(getAuthProfile('openai', 'p1')).toBeUndefined();
    });

    it('should clear all profiles', () => {
        registerAuthProfile({ id: 'p1', provider: 'openai', apiKey: 'sk-1' });
        registerAuthProfile({ id: 'p2', provider: 'anthropic', apiKey: 'sk-ant-1' });
        clearAuthProfiles();
        expect(listAuthProfiles()).toHaveLength(0);
    });
});

describe('resolveAuth', () => {
    beforeEach(() => clearAuthProfiles());

    it('should resolve from explicit override', () => {
        const result = resolveAuth(
            { provider: 'openai', model: 'gpt-4o' },
            undefined,
            { apiKey: 'sk-override-key' },
        );
        expect(result).not.toBeNull();
        expect(result!.source).toBe('override');
        expect(result!.profile.apiKey).toBe('sk-override-key');
    });

    it('should resolve from registered profile', () => {
        registerAuthProfile({ id: 'work', provider: 'openai', apiKey: 'sk-work-key', priority: 10 });
        const result = resolveAuth({ provider: 'openai', model: 'gpt-4o' });
        expect(result).not.toBeNull();
        expect(result!.source).toBe('config');
        expect(result!.profile.apiKey).toBe('sk-work-key');
    });

    it('should resolve named profile', () => {
        registerAuthProfile({ id: 'personal', provider: 'openai', apiKey: 'sk-personal' });
        registerAuthProfile({ id: 'work', provider: 'openai', apiKey: 'sk-work' });
        const result = resolveAuth({ provider: 'openai', model: 'gpt-4o' }, 'work');
        expect(result).not.toBeNull();
        expect(result!.profile.id).toBe('work');
    });

    it('should return default for ollama (no key needed)', () => {
        const result = resolveAuth({ provider: 'ollama', model: 'llama3' });
        expect(result).not.toBeNull();
        expect(result!.source).toBe('default');
        expect(result!.profile.apiKey).toBe('');
    });

    it('should return null when no credentials found', () => {
        const result = resolveAuth({ provider: 'unknown-provider', model: 'model' });
        expect(result).toBeNull();
    });

    it('should pick highest priority profile', () => {
        registerAuthProfile({ id: 'low', provider: 'openai', apiKey: 'sk-low', priority: 1 });
        registerAuthProfile({ id: 'high', provider: 'openai', apiKey: 'sk-high', priority: 10 });
        const result = resolveAuth({ provider: 'openai', model: 'gpt-4o' });
        expect(result!.profile.id).toBe('high');
    });
});

describe('getDefaultBaseUrl', () => {
    it('should return known provider URLs', () => {
        expect(getDefaultBaseUrl('openai')).toContain('openai.com');
        expect(getDefaultBaseUrl('anthropic')).toContain('anthropic.com');
        expect(getDefaultBaseUrl('google')).toContain('googleapis.com');
        expect(getDefaultBaseUrl('ollama')).toContain('localhost');
    });

    it('should normalize provider aliases', () => {
        expect(getDefaultBaseUrl('gpt')).toContain('openai.com');
        expect(getDefaultBaseUrl('claude')).toContain('anthropic.com');
    });

    it('should return undefined for unknown providers', () => {
        expect(getDefaultBaseUrl('unknown')).toBeUndefined();
    });
});

describe('hasCredentials', () => {
    beforeEach(() => clearAuthProfiles());

    it('should return true for registered profiles', () => {
        registerAuthProfile({ id: 'p1', provider: 'openai', apiKey: 'sk-test' });
        expect(hasCredentials('openai')).toBe(true);
    });

    it('should return true for ollama (no key needed)', () => {
        expect(hasCredentials('ollama')).toBe(true);
    });

    it('should return false for unconfigured providers', () => {
        expect(hasCredentials('unknown-provider-xyz')).toBe(false);
    });
});

describe('validateAuth', () => {
    it('should accept valid credentials', () => {
        const result = validateAuth('openai', { apiKey: 'sk-test-key-1234567890abcdef' });
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it('should reject missing API key', () => {
        const result = validateAuth('openai', { apiKey: '' });
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Missing API key for provider "openai"');
    });

    it('should allow empty key for ollama', () => {
        const result = validateAuth('ollama', { apiKey: '' });
        expect(result.valid).toBe(true);
    });

    it('should reject key with spaces', () => {
        const result = validateAuth('openai', { apiKey: 'sk test key' });
        expect(result.valid).toBe(false);
    });

    it('should warn about short keys', () => {
        const result = validateAuth('openai', { apiKey: 'short' });
        expect(result.warnings).toContain('API key seems too short');
    });

    it('should warn about non-standard OpenAI key prefix', () => {
        const result = validateAuth('openai', { apiKey: 'not-standard-key-abcdef' });
        expect(result.warnings.some((w) => w.includes('sk-'))).toBe(true);
    });

    it('should reject invalid base URL', () => {
        const result = validateAuth('openai', {
            apiKey: 'sk-test-key-1234567890',
            baseUrl: 'not-a-url',
        });
        expect(result.valid).toBe(false);
    });
});

describe('maskApiKey', () => {
    it('should mask middle of key', () => {
        expect(maskApiKey('sk-1234567890abcdef')).toBe('sk-1...cdef');
    });

    it('should handle short keys', () => {
        expect(maskApiKey('short')).toBe('***');
    });

    it('should handle empty keys', () => {
        expect(maskApiKey('')).toBe('***');
    });
});

describe('isApiKeyMasked', () => {
    it('should detect masked keys', () => {
        expect(isApiKeyMasked('sk-1...cdef')).toBe(true);
    });

    it('should detect unmasked keys', () => {
        expect(isApiKeyMasked('sk-1234567890')).toBe(false);
    });
});

describe('discoverConfiguredProviders', () => {
    beforeEach(() => clearAuthProfiles());

    it('should discover registered profile providers', () => {
        registerAuthProfile({ id: 'p1', provider: 'openai', apiKey: 'sk-1' });
        registerAuthProfile({ id: 'p2', provider: 'anthropic', apiKey: 'sk-ant-1' });
        const result = discoverConfiguredProviders();
        expect(result.some((r) => r.provider === 'openai')).toBe(true);
        expect(result.some((r) => r.provider === 'anthropic')).toBe(true);
    });
});
