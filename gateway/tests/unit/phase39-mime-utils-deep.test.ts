/**
 * CoreBlow Phase 39 — Mime Utils Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - getMimeType, isTextMime, isImageMime
 *   - detectMime via magic bytes
 */
import { describe, it, expect } from 'vitest';
import {
    getMimeType, isTextMime, isImageMime, detectMime,
} from '../../src/media/mime.js';

describe('MimeUtils — Extended', () => {
    it('should resolve correct mime from extension', () => {
        expect(getMimeType('test.png')).toBe('image/png');
        expect(getMimeType('test.HTML')).toBe('text/html'); // Case insensitive
        expect(getMimeType('file.unknown')).toBe('application/octet-stream');
        expect(getMimeType('noext')).toBe('application/octet-stream');
    });

    it('should identify text mimes', () => {
        expect(isTextMime('text/plain')).toBe(true);
        expect(isTextMime('text/html')).toBe(true);
        expect(isTextMime('application/json')).toBe(true);
        expect(isTextMime('application/javascript')).toBe(true);
        expect(isTextMime('image/png')).toBe(false);
    });

    it('should identify image mimes', () => {
        expect(isImageMime('image/png')).toBe(true);
        expect(isImageMime('image/jpeg')).toBe(true);
        expect(isImageMime('image/gif')).toBe(true);
        expect(isImageMime('text/plain')).toBe(false);
    });

    it('should detect PNG magic bytes', () => {
        const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
        expect(detectMime(buf)).toBe('image/png');
    });

    it('should detect JPEG magic bytes', () => {
        const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
        expect(detectMime(buf)).toBe('image/jpeg');
    });

    it('should detect GIF magic bytes', () => {
        const buf = Buffer.from([0x47, 0x49, 0x46, 0x38]); // GIF8
        expect(detectMime(buf)).toBe('image/gif');
    });

    it('should detect PDF magic bytes', () => {
        const buf = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
        expect(detectMime(buf)).toBe('application/pdf');
    });

    it('should fallback to octet-stream for unknown bytes', () => {
        const buf = Buffer.from([0x00, 0x01, 0x02, 0x03]);
        expect(detectMime(buf)).toBe('application/octet-stream');
    });

    it('should detect mime from Uint8Array', () => {
        const arr = new Uint8Array([0xFF, 0xD8, 0xFF]);
        expect(detectMime(arr)).toBe('image/jpeg');
    });

    it('should safely handle empty buffers in detectMime', () => {
        const buf = Buffer.from([]);
        expect(detectMime(buf)).toBe('application/octet-stream');
    });
});
