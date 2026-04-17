/**
 * tests/unit/media-understanding.test.ts
 * Tests for media understanding module
 */
import { describe, it, expect } from 'vitest';
import { MediaUnderstanding } from '../../src/media/understanding.js';

describe('MediaUnderstanding', () => {
    it('should create with default config', () => {
        const mu = new MediaUnderstanding();
        expect(mu).toBeDefined();
    });

    it('should create with custom config', () => {
        const mu = new MediaUnderstanding({
            visionProvider: 'gemini',
            whisperProvider: 'groq',
        });
        expect(mu).toBeDefined();
    });

    it('should detect image type from URL', async () => {
        const mu = new MediaUnderstanding();
        // Test type detection via analyze error (no API key)
        const result = await mu.analyze('test.jpg');
        expect(result.type).toBe('image');
    });

    it('should detect audio type from URL', async () => {
        const mu = new MediaUnderstanding();
        const result = await mu.analyze('test.mp3');
        expect(result.type).toBe('audio');
    });

    it('should detect video type from URL', async () => {
        const mu = new MediaUnderstanding();
        const result = await mu.analyze('test.mp4');
        expect(result.type).toBe('video');
    });

    it('should detect document type from URL', async () => {
        const mu = new MediaUnderstanding();
        const result = await mu.analyze('test.pdf');
        expect(result.type).toBe('document');
    });

    it('should handle MIME type override', async () => {
        const mu = new MediaUnderstanding();
        const result = await mu.analyze('file.bin', 'audio/mp3');
        expect(result.type).toBe('audio');
    });
});
