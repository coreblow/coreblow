import { describe, it, expect } from 'vitest';
import { GroqProvider } from './groq.js';

describe('GroqProvider — construction', () => {
    it('creates with default name', () => {
        const p = new GroqProvider();
        expect(p.name).toBe('groq');
    });

    it('accepts explicit API key', () => {
        const p = new GroqProvider({ apiKey: 'gsk_test' });
        expect(p.name).toBe('groq');
    });
});

describe('GroqProvider — isAvailable', () => {
    it('returns false when no API key', async () => {
        const p = new GroqProvider({ apiKey: '' });
        expect(await p.isAvailable()).toBe(false);
    });

    it('returns true when API key is set', async () => {
        const p = new GroqProvider({ apiKey: 'gsk_test' });
        expect(await p.isAvailable()).toBe(true);
    });
});

describe('GroqProvider — listModels', () => {
    it('returns known Groq models', () => {
        const p = new GroqProvider();
        const models = p.listModels();
        expect(models).toContain('llama-3.3-70b-versatile');
        expect(models).toContain('llama-3.1-8b-instant');
        expect(models).toContain('mixtral-8x7b-32768');
    });
});
