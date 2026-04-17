/**
 * CoreBlow Security — InputSanitizer Test Suite
 *
 * Covers: sanitizeShellArg(), isValidCommandName(), sanitizeShellArgs(),
 * sanitizePath(), isValidFilename(), findDangerousPattern(),
 * isValidMathExpression(), sanitizeForAppleScript(), stripAnsi(),
 * truncate(), isValidHttpUrl(), sanitizeUrl(), sanitizeText(),
 * sanitizeFilename(), detectInjection(), sanitizeObject().
 */
import { describe, it, expect } from 'vitest';
import {
    sanitizeShellArg,
    isValidCommandName,
    sanitizeShellArgs,
    sanitizePath,
    isValidFilename,
    findDangerousPattern,
    isValidMathExpression,
    sanitizeForAppleScript,
    stripAnsi,
    truncate,
    isValidHttpUrl,
    sanitizeUrl,
    sanitizeText,
    sanitizeFilename,
    detectInjection,
    sanitizeObject,
} from './input-sanitizer.js';

// ─── Shell Argument Sanitization ────────────────────────────────

describe('sanitizeShellArg()', () => {
    it('wraps input in single quotes', () => {
        expect(sanitizeShellArg('hello')).toBe("'hello'");
    });

    it('escapes internal single quotes', () => {
        expect(sanitizeShellArg("it's")).toBe("'it'\\''s'");
    });

    it('returns empty single-quoted string for empty input', () => {
        expect(sanitizeShellArg('')).toBe("''");
    });

    it('handles input with spaces', () => {
        expect(sanitizeShellArg('hello world')).toBe("'hello world'");
    });

    it('handles special shell characters', () => {
        const result = sanitizeShellArg('$(rm -rf /)');
        expect(result).toBe("'$(rm -rf /)'");
    });
});

describe('isValidCommandName()', () => {
    it('accepts alphanumeric with hyphens and underscores', () => {
        expect(isValidCommandName('ls')).toBe(true);
        expect(isValidCommandName('git-pull')).toBe(true);
        expect(isValidCommandName('my_command')).toBe(true);
        expect(isValidCommandName('node123')).toBe(true);
    });

    it('rejects names with special characters', () => {
        expect(isValidCommandName('rm -rf')).toBe(false);
        expect(isValidCommandName('cmd;drop')).toBe(false);
        expect(isValidCommandName('../etc')).toBe(false);
        expect(isValidCommandName('echo "hi"')).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isValidCommandName('')).toBe(false);
    });
});

describe('sanitizeShellArgs()', () => {
    it('sanitizes each argument in array', () => {
        const result = sanitizeShellArgs(['a', 'b', "it's"]);
        expect(result).toEqual(["'a'", "'b'", "'it'\\''s'"]);
    });

    it('handles empty array', () => {
        expect(sanitizeShellArgs([])).toEqual([]);
    });
});

// ─── Path Sanitization ──────────────────────────────────────────

describe('sanitizePath()', () => {
    it('removes ../ traversal sequences', () => {
        expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd');
    });

    it('removes ..\\ traversal (Windows)', () => {
        // sanitizePath removes literal ..\ sequences
        expect(sanitizePath('..\\..\\windows\\system32')).toBe('windows\\system32');
    });

    it('removes null bytes', () => {
        expect(sanitizePath('file.txt\0.exe')).toBe('file.txt.exe');
    });

    it('removes dangerous characters (<>:"|?*)', () => {
        expect(sanitizePath('file<name>:test|*.txt')).toBe('filenametest.txt');
    });

    it('trims whitespace', () => {
        expect(sanitizePath('  file.txt  ')).toBe('file.txt');
    });
});

describe('isValidFilename()', () => {
    it('accepts valid filenames', () => {
        expect(isValidFilename('readme.md')).toBe(true);
        expect(isValidFilename('my-file_v2.txt')).toBe(true);
        expect(isValidFilename('data.json')).toBe(true);
    });

    it('rejects . and ..', () => {
        expect(isValidFilename('.')).toBe(false);
        expect(isValidFilename('..')).toBe(false);
    });

    it('rejects empty string', () => {
        expect(isValidFilename('')).toBe(false);
    });

    it('rejects filenames with path separators', () => {
        expect(isValidFilename('path/file.txt')).toBe(false);
        expect(isValidFilename('path\\file.txt')).toBe(false);
    });

    it('rejects filenames exceeding 255 chars', () => {
        expect(isValidFilename('a'.repeat(256))).toBe(false);
    });

    it('rejects filenames with spaces', () => {
        expect(isValidFilename('my file.txt')).toBe(false);
    });
});

// ─── Expression Validation ──────────────────────────────────────

describe('findDangerousPattern()', () => {
    it('detects require()', () => {
        expect(findDangerousPattern("require('fs')")).toBe('require(');
    });

    it('detects eval()', () => {
        expect(findDangerousPattern('eval(code)')).toBe('eval(');
    });

    it('detects __proto__', () => {
        expect(findDangerousPattern('obj.__proto__')).toBe('__proto__');
    });

    it('detects process.', () => {
        expect(findDangerousPattern('process.exit(1)')).toBe('process.');
    });

    it('detects child_process', () => {
        expect(findDangerousPattern("import child_process from 'node'")).toBe('child_process');
    });

    it('detects globalThis', () => {
        expect(findDangerousPattern('globalThis.eval')).toBe('globalThis');
    });

    it('returns null for safe input', () => {
        expect(findDangerousPattern('2 + 2 = 4')).toBeNull();
    });
});

describe('isValidMathExpression()', () => {
    it('accepts basic math', () => {
        expect(isValidMathExpression('2 + 3 * 4')).toBe(true);
        expect(isValidMathExpression('(10 - 5) / 2')).toBe(true);
    });

    it('accepts math functions', () => {
        expect(isValidMathExpression('sin(0.5) + cos(1)')).toBe(true);
        expect(isValidMathExpression('sqrt(16)')).toBe(true);
    });

    it('accepts PI and E constants', () => {
        expect(isValidMathExpression('PI')).toBe(true);
        expect(isValidMathExpression('E')).toBe(true);
        expect(isValidMathExpression('2 * PI')).toBe(true);
    });

    it('rejects expressions with dangerous patterns', () => {
        expect(isValidMathExpression('require("fs")')).toBe(false);
        expect(isValidMathExpression('process.exit(1)')).toBe(false);
    });

    it('rejects alphabetic non-function text', () => {
        expect(isValidMathExpression('hello world')).toBe(false);
    });
});

// ─── String Sanitization ────────────────────────────────────────

describe('sanitizeForAppleScript()', () => {
    it('escapes backslashes', () => {
        expect(sanitizeForAppleScript('path\\to\\file')).toContain('\\\\');
    });

    it('escapes double quotes', () => {
        expect(sanitizeForAppleScript('say "hello"')).toContain('\\"');
    });

    it('escapes single quotes', () => {
        expect(sanitizeForAppleScript("it's")).toContain("\\'");
    });

    it('escapes backticks and dollar signs', () => {
        expect(sanitizeForAppleScript('`$HOME`')).toContain('\\`');
        expect(sanitizeForAppleScript('$var')).toContain('\\$');
    });

    it('replaces newlines with spaces', () => {
        expect(sanitizeForAppleScript('line1\nline2')).toBe('line1 line2');
    });

    it('removes carriage returns', () => {
        expect(sanitizeForAppleScript('text\r')).not.toContain('\r');
    });

    it('truncates to 256 characters', () => {
        const long = 'A'.repeat(500);
        expect(sanitizeForAppleScript(long).length).toBeLessThanOrEqual(256);
    });
});

describe('stripAnsi()', () => {
    it('removes ANSI color codes', () => {
        expect(stripAnsi('\x1B[31mred text\x1B[0m')).toBe('red text');
    });

    it('removes multiple ANSI sequences', () => {
        expect(stripAnsi('\x1B[1m\x1B[32mbold green\x1B[0m')).toBe('bold green');
    });

    it('returns plain text unchanged', () => {
        expect(stripAnsi('plain text')).toBe('plain text');
    });
});

describe('truncate()', () => {
    it('returns input unchanged if within limit', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    it('truncates and adds ellipsis', () => {
        expect(truncate('hello world this is long', 10)).toBe('hello w...');
    });

    it('returns input at exact limit', () => {
        expect(truncate('12345', 5)).toBe('12345');
    });
});

// ─── URL Sanitization ───────────────────────────────────────────

describe('isValidHttpUrl()', () => {
    it('accepts http URLs', () => {
        expect(isValidHttpUrl('http://example.com')).toBe(true);
    });

    it('accepts https URLs', () => {
        expect(isValidHttpUrl('https://example.com/path')).toBe(true);
    });

    it('rejects ftp URLs', () => {
        expect(isValidHttpUrl('ftp://files.example.com')).toBe(false);
    });

    it('rejects javascript: URLs', () => {
        expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
    });

    it('rejects malformed URLs', () => {
        expect(isValidHttpUrl('not a url')).toBe(false);
    });
});

describe('sanitizeUrl()', () => {
    it('allows http and https', () => {
        expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
    });

    it('blocks javascript: protocol', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    it('blocks data: protocol', () => {
        expect(sanitizeUrl('data:text/html,<h1>hi</h1>')).toBeNull();
    });

    it('blocks file: protocol', () => {
        expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
    });

    it('blocks vbscript: protocol', () => {
        expect(sanitizeUrl('vbscript:msgbox("hi")')).toBeNull();
    });

    it('returns null for malformed input', () => {
        expect(sanitizeUrl('not a url')).toBeNull();
    });
});

// ─── Legacy sanitizeText() ──────────────────────────────────────

describe('sanitizeText()', () => {
    it('strips HTML tags', () => {
        expect(sanitizeText('<script>alert(1)</script>Hello')).toBe('alert(1)Hello');
    });

    it('removes path traversal', () => {
        expect(sanitizeText('../../etc/passwd')).toBe('etc/passwd');
    });

    it('removes null bytes', () => {
        expect(sanitizeText('file\0name')).toBe('filename');
    });

    it('truncates to maxLength', () => {
        expect(sanitizeText('hello world', { maxLength: 5 })).toBe('hello');
    });

    it('preserves allowed tags', () => {
        const result = sanitizeText('<b>bold</b> <script>bad</script>', { allowTags: ['b'] });
        expect(result).toContain('<b>');
        expect(result).toContain('</b>');
        expect(result).not.toContain('<script>');
    });
});

// ─── sanitizeFilename() ─────────────────────────────────────────

describe('sanitizeFilename()', () => {
    it('replaces ../ with __', () => {
        expect(sanitizeFilename('../../test')).toBe('____test');
    });

    it('replaces path separators with _', () => {
        expect(sanitizeFilename('path/to/file')).toBe('path_to_file');
        expect(sanitizeFilename('path\\to\\file')).toBe('path_to_file');
    });

    it('replaces dangerous chars', () => {
        expect(sanitizeFilename('file<name>:test')).toBe('file_name__test');
    });
});

// ─── detectInjection() ──────────────────────────────────────────

describe('detectInjection()', () => {
    it('detects SQL injection', () => {
        const result = detectInjection("' OR 1=1 --");
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('sql-injection');
    });

    it('detects XSS', () => {
        const result = detectInjection('<script>alert(1)</script>');
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('xss');
    });

    it('detects command injection', () => {
        const result = detectInjection('; rm -rf /');
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('command-injection');
    });

    it('returns safe for clean input', () => {
        const result = detectInjection('Hello world, this is a normal message.');
        expect(result.safe).toBe(true);
        expect(result.threats).toBeUndefined();
    });

    it('detects multiple injection types', () => {
        const result = detectInjection("' OR DROP TABLE; <script>alert(1)</script> ; rm -rf /");
        expect(result.safe).toBe(false);
        expect(result.threats!.length).toBeGreaterThanOrEqual(2);
    });

    it('sets type to first threat found', () => {
        const result = detectInjection("' OR DROP TABLE users");
        expect(result.type).toBe('sql-injection');
    });

    it('sets pattern to first 50 chars', () => {
        const longInput = "' OR SELECT " + 'x'.repeat(100);
        const result = detectInjection(longInput);
        if (!result.safe) {
            expect(result.pattern!.length).toBeLessThanOrEqual(50);
        }
    });
});

// ─── sanitizeObject() ───────────────────────────────────────────

describe('sanitizeObject()', () => {
    it('sanitizes string values', () => {
        const result = sanitizeObject({ name: '<b>bold</b>' });
        expect(result.name).toBe('bold');
    });

    it('recursively sanitizes nested objects', () => {
        const result = sanitizeObject({
            outer: {
                inner: '<script>xss</script>hello',
            },
        });
        expect((result.outer as any).inner).toBe('xsshello');
    });

    it('preserves non-string values', () => {
        const result = sanitizeObject({ count: 42 as unknown as string, active: true as unknown as string });
        expect(result.count).toBe(42);
        expect(result.active).toBe(true);
    });

    it('preserves arrays as-is', () => {
        const result = sanitizeObject({ items: ['<b>a</b>', 'b'] as unknown as string });
        expect(Array.isArray(result.items)).toBe(true);
    });

    it('handles empty object', () => {
        expect(sanitizeObject({})).toEqual({});
    });
});
