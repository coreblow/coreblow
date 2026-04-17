/**
 * CoreBlow Phase 39 — TTS Queue, Streaming & OG Parser Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - TTSQueue: enqueue, sequential processing
 *   - TTSStreamer: chunk buffering, flushing
 *   - OGParser: parsing meta tags from HTML
 */
import { describe, it, expect } from 'vitest';
import { TTSQueue } from '../../src/tts/queue.js';
import { TTSStreamer } from '../../src/tts/streaming.js';
import { parseOpenGraph } from '../../src/link-understanding/og-parser.js';

describe('TTS & link-understanding — Extended', () => {
    describe('TTSQueue', () => {
        it('should enqueue and resolve messages', async () => {
            const queue = new TTSQueue();
            const res = await queue.add('Hello', 'voice-1');
            expect(Buffer.isBuffer(res)).toBe(true);
        });

        it('should process multiple messages', async () => {
            const queue = new TTSQueue();
            const r1 = queue.add('A', 'v1');
            const r2 = queue.add('B', 'v1');
            const results = await Promise.all([r1, r2]);
            expect(results).toHaveLength(2);
            expect(Buffer.isBuffer(results[0])).toBe(true);
        });
    });

    describe('TTSStreamer', () => {
        it('should stream chunks and flush combined buffer', () => {
            const stream = new TTSStreamer();
            stream.addChunk(Buffer.from('Hello '));
            stream.addChunk(Buffer.from('World'));
            const full = stream.flush();
            expect(full.toString()).toBe('Hello World');
        });

        it('should clear chunks', () => {
            const stream = new TTSStreamer();
            stream.addChunk(Buffer.from('Test'));
            stream.clear();
            const full = stream.flush();
            expect(full.length).toBe(0);
        });
    });

    describe('OG Parser', () => {
        it('should parse valid og tags', () => {
            const html = `
                <html>
                    <head>
                        <meta property="og:title" content="My Page" />
                        <meta property="og:description" content="A description" />
                        <meta property="og:image" content="https://abc.com/img.png">
                    </head>
                </html>
            `;
            const og = parseOpenGraph(html);
            expect(og.title).toBe('My Page');
            expect(og.description).toBe('A description');
            expect(og.image).toBe('https://abc.com/img.png');
        });

        it('should handle single quotes', () => {
            const html = `<meta property='og:site_name' content='Site' />`;
            const og = parseOpenGraph(html);
            expect(og.site_name).toBe('Site');
        });

        it('should return empty object for no tags', () => {
            const html = `<html><body>Just body</body></html>`;
            expect(Object.keys(parseOpenGraph(html))).toHaveLength(0);
        });
    });
});
