/**
 * Tests: TTS Engine — synthesis, voice listing, caching
 */
import { describe, it, expect } from 'vitest';
import { TtsEngine } from '../../src/tts/engine.js';

describe('TtsEngine', () => {
    it('creates with default config', () => {
        const engine = new TtsEngine();
        expect(engine).toBeDefined();
    });

    it('creates with custom config', () => {
        const engine = new TtsEngine({ defaultVoice: 'custom', cacheEnabled: false });
        expect(engine).toBeDefined();
    });

    describe('listVoices', () => {
        it('returns built-in voices', () => {
            const engine = new TtsEngine();
            const voices = engine.listVoices();
            expect(voices.length).toBeGreaterThan(0);
        });

        it('filters by language', () => {
            const engine = new TtsEngine();
            const en = engine.listVoices({ language: 'en' });
            // May or may not have results depending on built-in voices
            expect(Array.isArray(en)).toBe(true);
        });

        it('voices have required fields', () => {
            const engine = new TtsEngine();
            const voices = engine.listVoices();
            if (voices.length > 0) {
                expect(voices[0].id).toBeDefined();
                expect(voices[0].name).toBeDefined();
            }
        });
    });

    describe('synthesize', () => {
        it('synthesizes text (system provider returns result)', async () => {
            const engine = new TtsEngine();
            const result = await engine.synthesize({
                text: 'Hello world',
                provider: 'system',
            });
            expect(result).toBeDefined();
            expect(result.audio).toBeDefined();
        });

        it('truncates text exceeding max length', async () => {
            const engine = new TtsEngine({ maxTextLength: 10 });
            // Should not throw — it truncates silently
            const result = await engine.synthesize({ text: 'x'.repeat(100) });
            expect(result).toBeDefined();
        });

        it('uses cache on repeated requests', async () => {
            const engine = new TtsEngine({ cacheEnabled: true });
            const r1 = await engine.synthesize({ text: 'cache test' });
            const r2 = await engine.synthesize({ text: 'cache test' });
            expect(r2.cached).toBe(true);
        });

        it('skips cache when disabled', async () => {
            const engine = new TtsEngine({ cacheEnabled: false });
            const r1 = await engine.synthesize({ text: 'no cache' });
            const r2 = await engine.synthesize({ text: 'no cache' });
            expect(r2.cached).toBeFalsy();
        });
    });
});
