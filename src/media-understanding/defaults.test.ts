import { describe, it, expect } from 'vitest';
import { resolveMediaPrompt, resolveMediaModel, resolveMediaMaxTokens, DEFAULT_IMAGE_PROMPT, DEFAULT_AUDIO_MODEL } from './defaults.js';

describe('Media Defaults', () => {
    describe('resolveMediaPrompt', () => {
        it('returns custom prompt', () => {
            expect(resolveMediaPrompt({ type: 'image', customPrompt: 'Describe this' })).toBe('Describe this');
        });

        it('returns default for image', () => {
            expect(resolveMediaPrompt({ type: 'image' })).toBe(DEFAULT_IMAGE_PROMPT);
        });

        it('uses config prompt', () => {
            const cfg = { media: { prompts: { image: 'Custom image prompt' } } };
            expect(resolveMediaPrompt({ type: 'image', cfg })).toBe('Custom image prompt');
        });

        it('handles unknown type', () => {
            expect(resolveMediaPrompt({ type: 'unknown' })).toContain('unknown');
        });
    });

    describe('resolveMediaModel', () => {
        it('returns default image model', () => expect(resolveMediaModel('image')).toBe('gpt-4o'));
        it('returns default audio model', () => expect(resolveMediaModel('audio')).toBe('whisper-1'));
        it('uses config model', () => {
            expect(resolveMediaModel('image', { media: { models: { image: 'claude-3.5' } } })).toBe('claude-3.5');
        });
    });

    describe('resolveMediaMaxTokens', () => {
        it('defaults to 4096', () => expect(resolveMediaMaxTokens()).toBe(4096));
        it('respects model limit', () => expect(resolveMediaMaxTokens(2000, 4096)).toBe(2000));
        it('uses requested when lower', () => expect(resolveMediaMaxTokens(10000, 4096)).toBe(4096));
    });
});
