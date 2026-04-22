/**
 * CoreBlow — CLI Parse Bytes Tests
 *
 * Tests for parseByteSize covering units, defaults, and errors.
 */

import { describe, it, expect } from 'vitest';
import { parseByteSize } from './parse-bytes.js';

describe('parseByteSize', () => {
    describe('basic units', () => {
        it('parses bytes', () => {
            expect(parseByteSize('100b')).toBe(100);
        });

        it('parses kilobytes', () => {
            expect(parseByteSize('1kb')).toBe(1024);
            expect(parseByteSize('1k')).toBe(1024);
        });

        it('parses megabytes', () => {
            expect(parseByteSize('1mb')).toBe(1024 ** 2);
            expect(parseByteSize('1m')).toBe(1024 ** 2);
        });

        it('parses gigabytes', () => {
            expect(parseByteSize('2gb')).toBe(2 * 1024 ** 3);
            expect(parseByteSize('2g')).toBe(2 * 1024 ** 3);
        });

        it('parses terabytes', () => {
            expect(parseByteSize('1tb')).toBe(1024 ** 4);
        });
    });

    describe('decimal values', () => {
        it('handles 1.5mb', () => {
            expect(parseByteSize('1.5mb')).toBe(Math.round(1.5 * 1024 ** 2));
        });
    });

    describe('default unit', () => {
        it('defaults to bytes', () => {
            expect(parseByteSize('512')).toBe(512);
        });

        it('uses custom default unit', () => {
            expect(parseByteSize('10', { defaultUnit: 'mb' })).toBe(10 * 1024 ** 2);
        });
    });

    describe('case insensitivity', () => {
        it('handles uppercase', () => {
            expect(parseByteSize('1MB')).toBe(1024 ** 2);
            expect(parseByteSize('1GB')).toBe(1024 ** 3);
        });
    });

    describe('errors', () => {
        it('throws on empty', () => {
            expect(() => parseByteSize('')).toThrow('empty');
        });

        it('throws on invalid input', () => {
            expect(() => parseByteSize('abc')).toThrow('invalid');
        });

        it('throws on invalid unit', () => {
            expect(() => parseByteSize('10xyz')).toThrow('invalid');
        });
    });
});
