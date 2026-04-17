/**
 * CoreBlow Phase 39 — TTS Processing Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   OGParser fetch → Text extraction → TTSQueue processing → TTSStreamer chunking
 */
import { describe, it, expect } from 'vitest';
import { parseOpenGraph } from '../../src/link-understanding/og-parser.js';
import { TTSQueue } from '../../src/tts/queue.js';
import { TTSStreamer } from '../../src/tts/streaming.js';

describe('Phase39 Chain: Web to Audio Pipeline', () => {
    it('read OG description → generate audio via Queue → stream to user', async () => {
        // Step 1: Parse Webpage HTML
        const html = `
            <html>
                <meta property="og:title" content="News Article" />
                <meta property="og:description" content="CoreBlow releases Phase 39 audio update." />
            </html>
        `;
        const og = parseOpenGraph(html);
        expect(og.description).toContain('Phase 39');

        // Step 2: Push to TTS queue
        const queue = new TTSQueue();
        const audioBuffer = await queue.add(og.description!, 'alloy');
        expect(Buffer.isBuffer(audioBuffer)).toBe(true);

        // Step 3: Stream output (simulated chunking)
        const streamer = new TTSStreamer();
        streamer.addChunk(Buffer.from('Headers|'));
        streamer.addChunk(audioBuffer);
        streamer.addChunk(Buffer.from('|Footer'));

        const finalOutput = streamer.flush();
        expect(finalOutput.length).toBeGreaterThan(0);
        expect(finalOutput.toString()).toContain('Headers|');
        expect(finalOutput.toString()).toContain('|Footer');
    });
});
