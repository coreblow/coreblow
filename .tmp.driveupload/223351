/**
 * tts/streaming.test.ts — TTS streaming tests
 */
import { describe, it, expect } from 'vitest';
import { TTSStreamer } from './streaming.js';

describe('TTSStreamer', () => {
    it('should accumulate and flush chunks', () => {
        const s = new TTSStreamer();
        s.addChunk(Buffer.from('hello'));
        s.addChunk(Buffer.from(' world'));
        const result = s.flush();
        expect(result.toString()).toBe('hello world');
    });

    it('should clear chunks', () => {
        const s = new TTSStreamer();
        s.addChunk(Buffer.from('data'));
        s.clear();
        expect(s.flush().length).toBe(0);
    });
});
