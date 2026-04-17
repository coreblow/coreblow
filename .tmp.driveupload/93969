/**
 * CoreBlow Phase 39 — Media Processing Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   Buffer → detectMime → processBuffer → validate constraints
 */
import { describe, it, expect } from 'vitest';
import { detectMime } from '../../src/media/mime.js';
import { MediaProcessor } from '../../src/media/media-processor.js';

describe('Phase39 Chain: Media Pipeline', () => {
    it('should process and validate a PNG image for Discord', () => {
        // Step 1: Incoming buffer
        const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02]); // Fake PNG
        const filename = 'upload.png';

        // Step 2: Detect mime
        const mime = detectMime(buf);
        expect(mime).toBe('image/png');

        // Step 3: Process metadata
        const processor = new MediaProcessor();
        const meta = processor.processBuffer(buf, filename);
        expect(meta.type).toBe('image');
        expect(meta.mimeType).toBe('image/png'); // Maps from extension

        // Step 4: Validate against platform
        const result = processor.validate(meta, 'discord');
        expect(result.valid).toBe(true);
    });

    it('should process and reject an oversized video for WhatsApp', () => {
        const buf = Buffer.from('video-data'.repeat(1000));
        const filename = 'clip.mp4';

        const processor = new MediaProcessor();
        const meta = processor.processBuffer(buf, filename);
        meta.size = 20 * 1024 * 1024; // 20MB file

        // WhatsApp requires < 16MB
        const result = processor.validate(meta, 'whatsapp');
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('File too large');
    });

    it('should assign application/octet-stream for unknown bytes', () => {
        const buf = Buffer.from([0x00, 0x00, 0x00]);
        const mime = detectMime(buf);
        expect(mime).toBe('application/octet-stream');
    });
});
