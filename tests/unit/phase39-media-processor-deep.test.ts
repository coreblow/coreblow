/**
 * CoreBlow Phase 39 — MediaProcessor Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - processBuffer, type detection, MIME mapping
 *   - channel constraints validation
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { MediaProcessor } from '../../src/media/media-processor.js';
import * as path from 'node:path';

describe('MediaProcessor — Extended', () => {
    let processor: MediaProcessor;

    beforeEach(() => {
        processor = new MediaProcessor();
    });

    it('should process buffer and detect image', () => {
        const buffer = Buffer.from('fake-image-data');
        const meta = processor.processBuffer(buffer, 'test.png');

        expect(meta.filename).toBe('test.png');
        expect(meta.type).toBe('image');
        expect(meta.mimeType).toBe('image/png');
        expect(meta.size).toBe(buffer.length);
        expect(meta.hash).toBeDefined();
        expect(meta.id).toHaveLength(16); // 8 bytes hex
    });

    it('should process buffer and detect audio', () => {
        const meta = processor.processBuffer(Buffer.from('data'), 'song.mp3');
        expect(meta.type).toBe('audio');
        expect(meta.mimeType).toBe('audio/mpeg');
    });

    it('should process buffer and detect video', () => {
        const meta = processor.processBuffer(Buffer.from('data'), 'movie.mp4');
        expect(meta.type).toBe('video');
        expect(meta.mimeType).toBe('video/mp4');
    });

    it('should process buffer and detect document', () => {
        const meta = processor.processBuffer(Buffer.from('data'), 'doc.pdf');
        expect(meta.type).toBe('document');
        expect(meta.mimeType).toBe('application/pdf');
    });

    it('should fallback to unknown for unrecognized extension', () => {
        const meta = processor.processBuffer(Buffer.from('data'), 'mystery.xyz');
        expect(meta.type).toBe('unknown');
        expect(meta.mimeType).toBe('application/octet-stream');
    });

    it('should handle files without extension', () => {
        const meta = processor.processBuffer(Buffer.from('data'), 'noext');
        expect(meta.type).toBe('unknown');
        expect(meta.mimeType).toBe('application/octet-stream');
    });

    it('should validate against channel constraints — ok', () => {
        const meta = processor.processBuffer(Buffer.from('small'), 'ok.png');
        const res = processor.validate(meta, 'discord'); // Discord limits to 25MB
        expect(res.valid).toBe(true);
        expect(res.errors).toHaveLength(0);
    });

    it('should fail validation on file size', () => {
        const meta = processor.processBuffer(Buffer.from(''), 'huge.png');
        meta.size = 100 * 1024 * 1024; // 100MB
        const res = processor.validate(meta, 'discord'); // 25MB max
        expect(res.valid).toBe(false);
        expect(res.errors[0]).toContain('File too large');
    });

    it('should fail validation on unsupported type', () => {
        const meta = processor.processBuffer(Buffer.from(''), 'file.xyz');
        const res = processor.validate(meta, 'telegram');
        expect(res.valid).toBe(false);
        expect(res.errors.some(e => e.includes('Unsupported format: xyz'))).toBe(true);
    });

    it('should allow unknown channels (no constraints)', () => {
        const meta = processor.processBuffer(Buffer.from(''), 'file.xyz');
        const res = processor.validate(meta, 'mysterious-channel');
        expect(res.valid).toBe(true);
    });

    it('should get correct mime type via getMimeType', () => {
        expect(processor.getMimeType('png')).toBe('image/png');
        expect(processor.getMimeType('pdf')).toBe('application/pdf');
        expect(processor.getMimeType('.jpg')).toBe('image/jpeg'); // Tolerates dots? Actually the method strips it: replace('.', '')
        expect(processor.getMimeType('unknown')).toBe('application/octet-stream');
    });

    it('should handle processFile gracefully for nonexistent files (null)', () => {
        const meta = processor.processFile('/tmp/this/does/not/exist.xyz');
        expect(meta).toBeNull();
    });

    it('should return constraints for known channel', () => {
        const c = processor.getConstraints('whatsapp');
        expect(c).not.toBeNull();
        expect(c?.maxImageDimension).toBe(5000);
    });
});
