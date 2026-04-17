/**
 * CoreBlow — Input Sanitizer Unit Tests
 */
import { describe, it, expect } from 'vitest';
import {
    sanitizeShellArg, isValidCommandName, sanitizeShellArgs,
    sanitizePath, isValidFilename,
    findDangerousPattern, isValidMathExpression,
    sanitizeForAppleScript, stripAnsi, truncate,
    isValidHttpUrl, sanitizeUrl,
    sanitizeText, sanitizeFilename, detectInjection, sanitizeObject,
} from './input-sanitizer.js';

// ─── Shell ───────────────────────────────────────────────────────

describe('sanitizeShellArg', () => {
    it('should wrap in single quotes', () => {
        expect(sanitizeShellArg('hello')).toBe("'hello'");
    });

    it('should escape internal single quotes', () => {
        expect(sanitizeShellArg("it's")).toBe("'it'\\''s'");
    });

    it('should handle empty string', () => {
        expect(sanitizeShellArg('')).toBe("''");
    });

    it('should handle spaces', () => {
        expect(sanitizeShellArg('hello world')).toBe("'hello world'");
    });

    it('should handle special shell chars', () => {
        expect(sanitizeShellArg('$HOME;rm')).toBe("'$HOME;rm'");
    });
});

describe('isValidCommandName', () => {
    it('should accept alphanumeric with dashes and underscores', () => {
        expect(isValidCommandName('git')).toBe(true);
        expect(isValidCommandName('node-20')).toBe(true);
        expect(isValidCommandName('my_cmd')).toBe(true);
    });

    it('should reject special characters', () => {
        expect(isValidCommandName('rm -rf')).toBe(false);
        expect(isValidCommandName('cmd;evil')).toBe(false);
        expect(isValidCommandName('../bin')).toBe(false);
    });

    it('should reject empty string', () => {
        expect(isValidCommandName('')).toBe(false);
    });
});

describe('sanitizeShellArgs', () => {
    it('should sanitize each arg independently', () => {
        const result = sanitizeShellArgs(['hello', "it's", '']);
        expect(result).toEqual(["'hello'", "'it'\\''s'", "''"]);
    });
});

// ─── Path ────────────────────────────────────────────────────────

describe('sanitizePath', () => {
    it('should remove ../ traversal', () => {
        expect(sanitizePath('../../etc/passwd')).toBe('etc/passwd');
    });

    it('should remove ..\\ traversal', () => {
        // The regex targets literal "..\\" sequences
        expect(sanitizePath('..\\..\\windows\\system32')).toBe('windows\\system32');
    });

    it('should remove null bytes', () => {
        expect(sanitizePath('file\0.txt')).toBe('file.txt');
    });

    it('should remove special path chars', () => {
        expect(sanitizePath('file<>:"|?*.txt')).toBe('file.txt');
    });

    it('should trim whitespace', () => {
        expect(sanitizePath('  file.txt  ')).toBe('file.txt');
    });
});

describe('isValidFilename', () => {
    it('should accept normal filenames', () => {
        expect(isValidFilename('readme.md')).toBe(true);
        expect(isValidFilename('file-v2.tar.gz')).toBe(true);
    });

    it('should reject . and ..', () => {
        expect(isValidFilename('.')).toBe(false);
        expect(isValidFilename('..')).toBe(false);
    });

    it('should reject empty string', () => {
        expect(isValidFilename('')).toBe(false);
    });

    it('should reject names over 255 chars', () => {
        expect(isValidFilename('a'.repeat(256))).toBe(false);
    });

    it('should reject path separators', () => {
        expect(isValidFilename('dir/file')).toBe(false);
    });

    it('should accept names exactly 255 chars', () => {
        expect(isValidFilename('a'.repeat(255))).toBe(true);
    });
});

// ─── Expression Validation ───────────────────────────────────────

describe('findDangerousPattern', () => {
    it('should detect eval(', () => {
        expect(findDangerousPattern('eval(code)')).toBe('eval(');
    });

    it('should detect require(', () => {
        expect(findDangerousPattern("require('fs')")).toBe('require(');
    });

    it('should detect process.', () => {
        expect(findDangerousPattern('process.exit(1)')).toBe('process.');
    });

    it('should detect __proto__', () => {
        expect(findDangerousPattern('obj.__proto__')).toBe('__proto__');
    });

    it('should return null for safe input', () => {
        expect(findDangerousPattern('Math.sqrt(4) + 1')).toBeNull();
    });
});

describe('isValidMathExpression', () => {
    it('should accept simple math', () => {
        expect(isValidMathExpression('1 + 2 * 3')).toBe(true);
    });

    it('should accept math functions', () => {
        expect(isValidMathExpression('sin(3.14) + cos(0)')).toBe(true);
    });

    it('should accept PI and E', () => {
        expect(isValidMathExpression('PI')).toBe(true);
        expect(isValidMathExpression('E')).toBe(true);
    });

    it('should reject text expressions', () => {
        expect(isValidMathExpression('alert(1)')).toBe(false);
    });

    it('should accept parentheses and decimals', () => {
        expect(isValidMathExpression('(1.5 + 2.5) * 3')).toBe(true);
    });
});

// ─── String Sanitization ─────────────────────────────────────────

describe('sanitizeForAppleScript', () => {
    it('should escape double quotes', () => {
        expect(sanitizeForAppleScript('say "hello"')).toContain('\\"');
    });

    it('should escape backslashes', () => {
        expect(sanitizeForAppleScript('path\\file')).toContain('\\\\');
    });

    it('should replace newlines with space', () => {
        expect(sanitizeForAppleScript('line1\nline2')).not.toContain('\n');
    });

    it('should truncate to 256 chars', () => {
        const long = 'a'.repeat(500);
        expect(sanitizeForAppleScript(long).length).toBeLessThanOrEqual(256);
    });
});

describe('stripAnsi', () => {
    it('should remove ANSI color codes', () => {
        expect(stripAnsi('\x1B[31mred\x1B[0m')).toBe('red');
    });

    it('should leave plain text unchanged', () => {
        expect(stripAnsi('hello world')).toBe('hello world');
    });
});

describe('truncate', () => {
    it('should not truncate short text', () => {
        expect(truncate('hello', 10)).toBe('hello');
    });

    it('should truncate long text with ellipsis', () => {
        expect(truncate('hello world!', 8)).toBe('hello...');
    });

    it('should handle exact length', () => {
        expect(truncate('hello', 5)).toBe('hello');
    });
});

// ─── URL Sanitization ────────────────────────────────────────────

describe('isValidHttpUrl', () => {
    it('should accept http URLs', () => {
        expect(isValidHttpUrl('http://example.com')).toBe(true);
    });

    it('should accept https URLs', () => {
        expect(isValidHttpUrl('https://example.com/path?q=1')).toBe(true);
    });

    it('should reject ftp:', () => {
        expect(isValidHttpUrl('ftp://example.com')).toBe(false);
    });

    it('should reject invalid URLs', () => {
        expect(isValidHttpUrl('not a url')).toBe(false);
    });
});

describe('sanitizeUrl', () => {
    it('should allow https URLs', () => {
        expect(sanitizeUrl('https://example.com')).toBe('https://example.com/');
    });

    it('should block javascript: URLs', () => {
        expect(sanitizeUrl('javascript:alert(1)')).toBeNull();
    });

    it('should block data: URLs', () => {
        expect(sanitizeUrl('data:text/html,<h1>hi</h1>')).toBeNull();
    });

    it('should block file: URLs', () => {
        expect(sanitizeUrl('file:///etc/passwd')).toBeNull();
    });

    it('should return null for invalid URLs', () => {
        expect(sanitizeUrl('not a url')).toBeNull();
    });
});

// ─── Legacy Functions ────────────────────────────────────────────

describe('sanitizeText', () => {
    it('should strip HTML tags by default', () => {
        expect(sanitizeText('<b>bold</b> text')).toBe('bold text');
    });

    it('should keep allowed tags', () => {
        const result = sanitizeText('<b>bold</b> <script>evil</script>', { allowTags: ['b'] });
        expect(result).toContain('<b>bold</b>');
        expect(result).not.toContain('<script>');
    });

    it('should remove path traversal', () => {
        expect(sanitizeText('../../etc/passwd')).toBe('etc/passwd');
    });

    it('should remove null bytes', () => {
        expect(sanitizeText('hello\0world')).toBe('helloworld');
    });

    it('should truncate to maxLength', () => {
        expect(sanitizeText('hello world', { maxLength: 5 })).toBe('hello');
    });
});

describe('sanitizeFilename', () => {
    it('should replace ../ with __', () => {
        expect(sanitizeFilename('../../file.txt')).toBe('____file.txt');
    });

    it('should replace / and \\ with _', () => {
        expect(sanitizeFilename('dir/sub\\file')).toBe('dir_sub_file');
    });

    it('should replace special chars', () => {
        expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file_______.txt');
    });
});

describe('detectInjection', () => {
    it('should detect SQL injection', () => {
        const result = detectInjection("'; DROP TABLE users--");
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('sql-injection');
    });

    it('should detect XSS', () => {
        const result = detectInjection('<script>alert(1)</script>');
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('xss');
    });

    it('should detect command injection', () => {
        const result = detectInjection('hello; rm -rf /');
        expect(result.safe).toBe(false);
        expect(result.threats).toContain('command-injection');
    });

    it('should return safe for clean input', () => {
        const result = detectInjection('Hello, how are you?');
        expect(result.safe).toBe(true);
        expect(result.threats).toBeUndefined();
    });

    it('should include pattern in result when unsafe', () => {
        const result = detectInjection("' OR 1=1--");
        expect(result.pattern).toBeDefined();
    });
});

describe('sanitizeObject', () => {
    it('should sanitize all string values', () => {
        const result = sanitizeObject({ name: '<b>John</b>', age: 30 });
        expect(result.name).toBe('John');
        expect(result.age).toBe(30);
    });

    it('should recursively sanitize nested objects', () => {
        const result = sanitizeObject({
            user: { name: '<script>evil</script>' },
        }) as { user: { name: string } };
        expect(result.user.name).toBe('evil');
    });

    it('should preserve arrays and non-object values', () => {
        const result = sanitizeObject({ tags: ['a', 'b'], count: 5 });
        expect(result.tags).toEqual(['a', 'b']);
        expect(result.count).toBe(5);
    });
});
