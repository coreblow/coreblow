/**
 * tests/security/input-sanitizer.test.ts
 * Tests for XSS, SQL injection, command injection, and sanitization.
 */
import { describe, it, expect } from 'vitest';
import {
    sanitizeText,
    sanitizeFilename,
    sanitizePath,
    sanitizeUrl,
    sanitizeShellArg,
    detectInjection,
    findDangerousPattern,
    isValidFilename,
    isValidHttpUrl,
    isValidMathExpression,
    stripAnsi,
    truncate,
    sanitizeObject,
} from '../../src/security/input-sanitizer.js';

describe('InputSanitizer', () => {
    // ── XSS ──────────────────────────────────────────────────────
    it('should strip HTML tags', () => {
        expect(sanitizeText('<script>alert(1)</script>Hello')).toBe('alert(1)Hello');
    });

    it('should strip nested tags', () => {
        expect(sanitizeText('<div><b>bold</b></div>')).toBe('bold');
    });

    it('should allow specified tags', () => {
        const result = sanitizeText('<b>bold</b><script>x</script>', { allowTags: ['b'] });
        expect(result).toContain('<b>');
        expect(result).not.toContain('<script>');
    });

    // ── SQL Injection ────────────────────────────────────────────
    it('should detect SQL injection', () => {
        const r = detectInjection("'; DROP TABLE users; --");
        expect(r.safe).toBe(false);
        expect(r.threats).toContain('sql-injection');
    });

    it('should detect UNION SELECT', () => {
        const r = detectInjection("' UNION SELECT * FROM passwords --");
        expect(r.safe).toBe(false);
    });

    // ── Command Injection ────────────────────────────────────────
    it('should detect shell injection', () => {
        const r = detectInjection('filename; rm -rf /');
        expect(r.safe).toBe(false);
        expect(r.threats).toContain('command-injection');
    });

    it('should detect XSS via script tag', () => {
        const r = detectInjection('<script>alert(1)</script>');
        expect(r.safe).toBe(false);
        expect(r.threats).toContain('xss');
    });

    it('should pass clean input', () => {
        const r = detectInjection('Hello, this is a normal message');
        expect(r.safe).toBe(true);
    });

    // ── Path Traversal ───────────────────────────────────────────
    it('should strip path traversal', () => {
        expect(sanitizePath('../../../etc/passwd')).toBe('etc/passwd');
    });

    it('should strip null bytes', () => {
        expect(sanitizePath('file.txt\0.jpg')).toBe('file.txt.jpg');
    });

    // ── Filename ─────────────────────────────────────────────────
    it('should sanitize filename with slashes', () => {
        expect(sanitizeFilename('../../etc/passwd')).not.toContain('..');
    });

    it('should validate clean filenames', () => {
        expect(isValidFilename('report.pdf')).toBe(true);
    });

    it('should reject . and .. filenames', () => {
        expect(isValidFilename('.')).toBe(false);
        expect(isValidFilename('..')).toBe(false);
    });

    it('should reject filenames over 255 chars', () => {
        expect(isValidFilename('a'.repeat(256))).toBe(false);
    });

    // ── URL ──────────────────────────────────────────────────────
    it('should validate HTTP URLs', () => {
        expect(isValidHttpUrl('https://example.com')).toBe(true);
        expect(isValidHttpUrl('ftp://evil.com')).toBe(false);
    });

    it('should block javascript: URLs', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    it('should block data: URLs', () => {
        expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeNull();
    });

    it('should allow safe URLs', () => {
        expect(sanitizeUrl('https://example.com/page')).toBe('https://example.com/page');
    });

    // ── Shell ────────────────────────────────────────────────────
    it('should escape shell arguments', () => {
        const arg = sanitizeShellArg("file; rm -rf /");
        // Should be wrapped in single quotes for safe shell use
        expect(arg.startsWith("'")).toBe(true);
        expect(arg.endsWith("'")).toBe(true);
    });

    // ── Dangerous Patterns ───────────────────────────────────────
    it('should find eval()', () => {
        expect(findDangerousPattern('eval(input)')).toBe('eval(');
    });

    it('should find require()', () => {
        expect(findDangerousPattern("require('fs')")).toBe('require(');
    });

    it('should pass safe expressions', () => {
        expect(findDangerousPattern('2 + 2')).toBeNull();
    });

    // ── Math Expressions ─────────────────────────────────────────
    it('should validate math expressions', () => {
        expect(isValidMathExpression('2 + 3 * 4')).toBe(true);
        expect(isValidMathExpression('sin(PI)')).toBe(true);
    });

    // ── Utility ──────────────────────────────────────────────────
    it('should strip ANSI codes', () => {
        expect(stripAnsi('\x1B[31mred\x1B[0m')).toBe('red');
    });

    it('should truncate with ellipsis', () => {
        expect(truncate('hello world', 8)).toBe('hello...');
    });

    it('should not truncate short text', () => {
        expect(truncate('hi', 10)).toBe('hi');
    });

    it('should validate filenames properly', () => {
        expect(isValidFilename('myFile_v2')).toBe(true);
        expect(isValidFilename('rm -rf')).toBe(false);
    });

    it('should sanitize object recursively', () => {
        const obj = sanitizeObject({ name: '<b>test</b>', nested: { val: '<script>x</script>' } });
        expect(obj.name).toBe('test');
        expect((obj.nested as Record<string, unknown>).val).toBe('x');
    });
});
