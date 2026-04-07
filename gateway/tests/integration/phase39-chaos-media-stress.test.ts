/**
 * CoreBlow Phase 39 — Media & TTS Chaos Tests
 *
 * Layer 3 (Adversarial):
 *   - MediaProcessor: extreme sizes, edge extensions, null buffers
 *   - MIME: malformed magic bytes
 *   - TTS Queue: concurrent storm
 *   - TTS Streamer: mass chunking
 */
import { describe, it, expect } from 'vitest';
import { MediaProcessor } from '../../src/media/media-processor.js';
import { detectMime } from '../../src/media/mime.js';
import { TTSQueue } from '../../src/tts/queue.js';
import { TTSStreamer } from '../../src/tts/streaming.js';
import { parseOpenGraph } from '../../src/link-understanding/og-parser.js';

describe('Phase39 Chaos: Media Stress', () => {
    it('MediaProcessor with missing/malformed extensions', () => {
        const p = new MediaProcessor();
        expect(p.processBuffer(Buffer.from(''), '').type).toBe('unknown');
        expect(p.processBuffer(Buffer.from(''), '.').type).toBe('unknown');
        expect(p.processBuffer(Buffer.from(''), '....png').type).toBe('image'); // ext is png
        expect(p.processBuffer(Buffer.from(''), 'no-dot').type).toBe('unknown');
    });

    it('MIME detection on tiny/empty buffers', () => {
        expect(detectMime(Buffer.from([]))).toBe('application/octet-stream');
        expect(detectMime(Buffer.from([0x89]))).toBe('application/octet-stream'); // incomplete PNG header
    });

    it('TTS Queue concurrent storm', async () => {
        const queue = new TTSQueue();
        const promises = [];
        for (let i = 0; i < 100; i++) {
            promises.push(queue.add(`Text ${i}`, 'voice'));
        }
        const results = await Promise.all(promises);
        expect(results).toHaveLength(100);
        expect(results.every(r => Buffer.isBuffer(r))).toBe(true);
    });

    it('TTS Streamer mass chunk flush', () => {
        const stream = new TTSStreamer();
        for (let i = 0; i < 1000; i++) {
            stream.addChunk(Buffer.from('A'));
        }
        const full = stream.flush();
        expect(full.length).toBe(1000);
        expect(full.toString()).toBe('A'.repeat(1000));
    });

    it('OG Parser adversarial HTML inputs', () => {
        const malformed1 = `<meta property="og:title" content=NoQuotes>`; // We regex expects quotes
        expect(parseOpenGraph(malformed1).title).toBeUndefined();

        const duplicateTags = `
            <meta property="og:title" content="A" />
            <meta property="og:title" content="B" />
        `;
        // Should overwrite with the last one
        expect(parseOpenGraph(duplicateTags).title).toBe('B');
    });
});
