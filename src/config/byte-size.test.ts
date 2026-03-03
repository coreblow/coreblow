import { describe, it, expect } from 'vitest';
import { parseByteSize, parseNonNegativeByteSize, formatByteSize, isValidNonNegativeByteSizeString } from './byte-size.js';

describe('Byte Size', () => {
    describe('parseByteSize', () => {
        it('parses plain bytes', () => expect(parseByteSize('1024')).toBe(1024));
        it('parses KB', () => expect(parseByteSize('1kb')).toBe(1024));
        it('parses MB', () => expect(parseByteSize('2mb')).toBe(2 * 1024 * 1024));
        it('parses GB', () => expect(parseByteSize('1.5gb')).toBe(Math.floor(1.5 * 1024 * 1024 * 1024)));
        it('parses with spaces', () => expect(parseByteSize('512 kb')).toBe(512 * 1024));
        it('parses case insensitive', () => expect(parseByteSize('1MB')).toBe(1024 * 1024));
        it('uses default unit', () => expect(parseByteSize('1024', { defaultUnit: 'kb' })).toBe(1024 * 1024));
        it('throws on empty', () => expect(() => parseByteSize('')).toThrow());
        it('throws on invalid', () => expect(() => parseByteSize('abc')).toThrow());
        it('throws on unknown unit', () => expect(() => parseByteSize('1xyz')).toThrow());
    });

    describe('parseNonNegativeByteSize', () => {
        it('parses number', () => expect(parseNonNegativeByteSize(1024)).toBe(1024));
        it('parses string', () => expect(parseNonNegativeByteSize('2mb')).toBe(2 * 1024 * 1024));
        it('returns null for negative', () => expect(parseNonNegativeByteSize(-1)).toBeNull());
        it('returns null for null', () => expect(parseNonNegativeByteSize(null)).toBeNull());
        it('returns null for invalid string', () => expect(parseNonNegativeByteSize('abc')).toBeNull());
        it('returns null for empty string', () => expect(parseNonNegativeByteSize('')).toBeNull());
    });

    describe('formatByteSize', () => {
        it('formats bytes', () => expect(formatByteSize(500)).toBe('500 B'));
        it('formats KB', () => expect(formatByteSize(2048)).toBe('2.0 KB'));
        it('formats MB', () => expect(formatByteSize(1024 * 1024 * 5)).toBe('5.0 MB'));
        it('formats GB', () => expect(formatByteSize(1024 * 1024 * 1024 * 2)).toBe('2.00 GB'));
    });

    describe('isValidNonNegativeByteSizeString', () => {
        it('valid', () => expect(isValidNonNegativeByteSizeString('10mb')).toBe(true));
        it('invalid', () => expect(isValidNonNegativeByteSizeString('abc')).toBe(false));
    });
});
