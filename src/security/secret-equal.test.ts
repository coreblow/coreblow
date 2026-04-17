/**
 * CoreBlow — Secret Equal Unit Tests
 */
import { describe, it, expect } from 'vitest';
import { safeEqualSecret } from './secret-equal.js';

describe('safeEqualSecret', () => {
    // ─── Matching Secrets ────────────────────────────────────────

    describe('matching secrets', () => {
        it('should return true for identical strings', () => {
            expect(safeEqualSecret('my-secret-key', 'my-secret-key')).toBe(true);
        });

        it('should return true for empty strings', () => {
            expect(safeEqualSecret('', '')).toBe(true);
        });

        it('should return true for long matching strings', () => {
            const long = 'a'.repeat(10000);
            expect(safeEqualSecret(long, long)).toBe(true);
        });

        it('should return true for strings with special characters', () => {
            const s = '!@#$%^&*()_+{}|:"<>?';
            expect(safeEqualSecret(s, s)).toBe(true);
        });

        it('should return true for base64 tokens', () => {
            const token = 'dGhpcyBpcyBhIHNlY3JldCB0b2tlbg==';
            expect(safeEqualSecret(token, token)).toBe(true);
        });
    });

    // ─── Non-Matching Secrets ────────────────────────────────────

    describe('non-matching secrets', () => {
        it('should return false for different strings', () => {
            expect(safeEqualSecret('secret-a', 'secret-b')).toBe(false);
        });

        it('should return false for different lengths', () => {
            expect(safeEqualSecret('short', 'a-much-longer-string')).toBe(false);
        });

        it('should return false for case differences', () => {
            expect(safeEqualSecret('Secret', 'secret')).toBe(false);
        });

        it('should return false for one-char difference', () => {
            expect(safeEqualSecret('abcdef', 'abcdeg')).toBe(false);
        });
    });

    // ─── Null / Undefined Handling ───────────────────────────────

    describe('null/undefined handling', () => {
        it('should return false when provided is undefined', () => {
            expect(safeEqualSecret(undefined, 'secret')).toBe(false);
        });

        it('should return false when expected is undefined', () => {
            expect(safeEqualSecret('secret', undefined)).toBe(false);
        });

        it('should return false when both are undefined', () => {
            expect(safeEqualSecret(undefined, undefined)).toBe(false);
        });

        it('should return false when provided is null', () => {
            expect(safeEqualSecret(null, 'secret')).toBe(false);
        });

        it('should return false when expected is null', () => {
            expect(safeEqualSecret('secret', null)).toBe(false);
        });

        it('should return false when both are null', () => {
            expect(safeEqualSecret(null, null)).toBe(false);
        });

        it('should return false for null vs undefined', () => {
            expect(safeEqualSecret(null, undefined)).toBe(false);
        });
    });

    // ─── Timing Safety ───────────────────────────────────────────

    describe('timing safety', () => {
        it('should use SHA-256 hashing for constant-length comparison', () => {
            // Verifies the function doesn't throw for various length inputs
            // (SHA-256 always produces 32-byte digest, so timingSafeEqual works)
            expect(safeEqualSecret('a', 'b')).toBe(false);
            expect(safeEqualSecret('a'.repeat(100), 'b'.repeat(1))).toBe(false);
        });
    });
});
