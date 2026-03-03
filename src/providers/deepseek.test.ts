import { describe, it, expect } from 'vitest';
import { DeepSeekProvider } from './deepseek.js';

describe('DeepSeekProvider — construction', () => {
    it('creates with default name', () => {
        const p = new DeepSeekProvider();
        expect(p.name).toBe('deepseek');
    });

    it('accepts explicit API key', () => {
        const p = new DeepSeekProvider({ apiKey: 'test-key-123' });
        expect(p.name).toBe('deepseek');
    });
});

describe('DeepSeekProvider — isAvailable', () => {
    it('returns false when no API key', async () => {
        const p = new DeepSeekProvider({ apiKey: '' });
        expect(await p.isAvailable()).toBe(false);
    });

    it('returns true when API key is set', async () => {
        const p = new DeepSeekProvider({ apiKey: 'sk-test' });
        expect(await p.isAvailable()).toBe(true);
    });
});

describe('DeepSeekProvider — listModels', () => {
    it('returns known DeepSeek models', () => {
        const p = new DeepSeekProvider();
        const models = p.listModels();
        expect(models).toContain('deepseek-chat');
        expect(models).toContain('deepseek-reasoner');
        expect(models.length).toBeGreaterThanOrEqual(2);
    });
});
