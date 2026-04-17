/**
 * config/legacy.shared.test.ts — Legacy config detection tests
 */
import { describe, it, expect } from 'vitest';
import { isLegacyConfig, detectLegacyKeys } from './legacy.shared.js';

describe('Legacy Config Detection', () => {
    it('should detect legacy config', () => {
        expect(isLegacyConfig({ model: 'gpt-4', apiKey: 'sk-123' })).toBe(true);
    });

    it('should not flag new format', () => {
        expect(isLegacyConfig({ models: { default: 'gpt-4o' } })).toBe(false);
    });

    it('should list legacy keys', () => {
        const keys = detectLegacyKeys({ model: 'gpt-4', prompt: 'hello', other: true });
        expect(keys).toContain('model');
        expect(keys).toContain('prompt');
        expect(keys).not.toContain('other');
    });
});
