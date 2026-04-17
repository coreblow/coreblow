// @ts-nocheck
/**
 * media-understanding/scope.test.ts — Media scope tests
 */
import { describe, it, expect } from 'vitest';
import { resolveMediaScope, validateMediaScope, getSupportedFormats, detectMediaType, detectMediaTypeFromExt } from './scope.js';
import { MediaSizeExceededError, MediaFormatError } from './errors.js';

describe('Media Scope', () => {
    describe('resolveMediaScope', () => {
        it('returns defaults', () => {
            const scope = resolveMediaScope();
            expect(scope.allowedTypes).toEqual(['image', 'audio', 'video', 'document']);
            expect(scope.maxFileSizeBytes).toBe(20 * 1024 * 1024);
        });

        it('uses config overrides', () => {
            const scope = resolveMediaScope({ media: { maxFileSizeBytes: 5000 } });
            expect(scope.maxFileSizeBytes).toBe(5000);
        });
    });

    describe('validateMediaScope', () => {
        it('passes valid media', () => {
            expect(() => validateMediaScope({ type: 'image', sizeBytes: 1000 })).not.toThrow();
        });

        it('throws on size exceeded', () => {
            expect(() => validateMediaScope({ type: 'image', sizeBytes: 999999999 })).toThrow(MediaSizeExceededError);
        });
    });

    describe('getSupportedFormats', () => {
        it('image formats', () => {
            const formats = getSupportedFormats('image');
            expect(formats).toContain('png');
            expect(formats).toContain('jpg');
        });

        it('audio formats', () => {
            expect(getSupportedFormats('audio')).toContain('mp3');
        });

        it('unknown type', () => {
            expect(getSupportedFormats('unknown' as any)).toEqual([]);
        });
    });

    describe('detectMediaType', () => {
        it('image/png', () => expect(detectMediaType('image/png')).toBe('image'));
        it('audio/mp3', () => expect(detectMediaType('audio/mp3')).toBe('audio'));
        it('video/mp4', () => expect(detectMediaType('video/mp4')).toBe('video'));
        it('application/pdf', () => expect(detectMediaType('application/pdf')).toBe('document'));
        it('text/plain', () => expect(detectMediaType('text/plain')).toBe('document'));
        it('unknown', () => expect(detectMediaType('application/octet-stream')).toBeNull());
    });

    describe('detectMediaTypeFromExt', () => {
        it('.png → image', () => expect(detectMediaTypeFromExt('.png')).toBe('image'));
        it('mp3 → audio', () => expect(detectMediaTypeFromExt('mp3')).toBe('audio'));
        it('.mp4 → video', () => expect(detectMediaTypeFromExt('.mp4')).toBe('video'));
        it('.pdf → document', () => expect(detectMediaTypeFromExt('.pdf')).toBe('document'));
        it('.xyz → null', () => expect(detectMediaTypeFromExt('.xyz')).toBeNull());
    });
});
