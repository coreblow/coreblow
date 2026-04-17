/**
 * commands/configure.shared.test.ts — Configure shared tests
 */
import { describe, it, expect } from 'vitest';
import { validateProviderKey, getProviderEnvVar, MODEL_PROVIDERS } from './configure.shared.js';

describe('Configure Shared', () => {
    it('should validate OpenAI key format', () => {
        expect(validateProviderKey('openai', 'sk-1234567890').valid).toBe(true);
        expect(validateProviderKey('openai', 'invalid').valid).toBe(false);
    });

    it('should reject empty keys', () => {
        expect(validateProviderKey('openai', '').valid).toBe(false);
    });

    it('should get provider env var', () => {
        expect(getProviderEnvVar('openai')).toBe('OPENAI_API_KEY');
        expect(getProviderEnvVar('anthropic')).toBe('ANTHROPIC_API_KEY');
        expect(getProviderEnvVar('unknown')).toBeUndefined();
    });

    it('should have providers defined', () => {
        expect(MODEL_PROVIDERS.length).toBeGreaterThan(3);
    });
});
