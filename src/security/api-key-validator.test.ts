import { describe, it, expect } from 'vitest';

describe('API Key Validator', () => {
    it('should reject empty keys', async () => {
        const { validateApiKey } = await import('./api-key-validator.js');
        expect(validateApiKey('').valid).toBe(false);
    });

    it('should reject short keys', async () => {
        const { validateApiKey } = await import('./api-key-validator.js');
        expect(validateApiKey('abc').valid).toBe(false);
        expect(validateApiKey('abc').reason).toContain('short');
    });

    it('should accept valid keys', async () => {
        const { validateApiKey } = await import('./api-key-validator.js');
        expect(validateApiKey('sk-1234567890abcdefghij').valid).toBe(true);
    });
});
