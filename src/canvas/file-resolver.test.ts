import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import {
    normalizeUrlPath,
    resolveFileWithinRoot,
    isPathSafe,
    sanitizeFilename,
    PathTraversalError,
} from './file-resolver.js';

// ─── Test fixtures ──────────────────────────────────────────────

let tmpRoot: string;

beforeAll(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-canvas-test-'));
    // Create test structure:
    //   tmpRoot/
    //     index.html
    //     page.html
    //     sub/
    //       nested.html
    //       index.html
    //     empty-dir/
    await fs.writeFile(path.join(tmpRoot, 'index.html'), '<h1>root</h1>');
    await fs.writeFile(path.join(tmpRoot, 'page.html'), '<h1>page</h1>');
    await fs.mkdir(path.join(tmpRoot, 'sub'), { recursive: true });
    await fs.writeFile(path.join(tmpRoot, 'sub', 'nested.html'), '<h1>nested</h1>');
    await fs.writeFile(path.join(tmpRoot, 'sub', 'index.html'), '<h1>sub-index</h1>');
    await fs.mkdir(path.join(tmpRoot, 'empty-dir'), { recursive: true });
});

afterAll(async () => {
    await fs.rm(tmpRoot, { recursive: true, force: true });
});

// ─── normalizeUrlPath ───────────────────────────────────────────

describe('normalizeUrlPath', () => {
    it('normalizes a simple path', () => {
        expect(normalizeUrlPath('/page.html')).toBe('/page.html');
    });

    it('adds leading slash', () => {
        expect(normalizeUrlPath('page.html')).toBe('/page.html');
    });

    it('strips query strings', () => {
        expect(normalizeUrlPath('/page.html?v=1&x=2')).toBe('/page.html');
    });

    it('strips fragments', () => {
        expect(normalizeUrlPath('/page.html#section')).toBe('/page.html');
    });

    it('strips both query and fragment', () => {
        expect(normalizeUrlPath('/page.html?a=1#top')).toBe('/page.html');
    });

    it('decodes percent-encoded chars', () => {
        expect(normalizeUrlPath('/my%20page.html')).toBe('/my page.html');
    });

    it('normalizes double slashes', () => {
        const result = normalizeUrlPath('//foo//bar.html');
        expect(result).not.toContain('//');
    });

    it('normalizes traversal sequences', () => {
        const result = normalizeUrlPath('/sub/../page.html');
        expect(result).toBe('/page.html');
    });

    it('throws PathTraversalError on null byte', () => {
        expect(() => normalizeUrlPath('/page\0.html')).toThrow(PathTraversalError);
    });

    it('returns / for malformed encoding', () => {
        expect(normalizeUrlPath('/%ZZ')).toBe('/');
    });

    it('handles empty string', () => {
        expect(normalizeUrlPath('')).toBe('/.');
    });
});

// ─── isPathSafe ─────────────────────────────────────────────────

describe('isPathSafe', () => {
    it('allows simple relative paths', () => {
        expect(isPathSafe('page.html')).toBe(true);
        expect(isPathSafe('sub/nested.html')).toBe(true);
    });

    it('allows paths starting with /', () => {
        expect(isPathSafe('/page.html')).toBe(true);
    });

    it('blocks null bytes', () => {
        expect(isPathSafe('page\0.html')).toBe(false);
    });

    it('blocks ../ traversal', () => {
        expect(isPathSafe('../etc/passwd')).toBe(false);
    });

    it('blocks /.. traversal', () => {
        expect(isPathSafe('sub/../../etc/passwd')).toBe(false);
    });

    it('allows paths with dots in filenames', () => {
        expect(isPathSafe('file.backup.html')).toBe(true);
    });

    it('allows current directory dot', () => {
        expect(isPathSafe('./page.html')).toBe(true);
    });
});

// ─── sanitizeFilename ───────────────────────────────────────────

describe('sanitizeFilename', () => {
    it('passes through clean filenames', () => {
        expect(sanitizeFilename('report.pdf')).toBe('report.pdf');
        expect(sanitizeFilename('my-file_v2.txt')).toBe('my-file_v2.txt');
    });

    it('removes null bytes', () => {
        expect(sanitizeFilename('file\0.txt')).toBe('file.txt');
    });

    it('replaces path separators with underscore', () => {
        expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
        expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
    });

    it('replaces dangerous characters', () => {
        expect(sanitizeFilename('file<>:"|?*.txt')).toBe('file_______.txt');
    });

    it('removes leading dots', () => {
        expect(sanitizeFilename('.hidden')).toBe('hidden');
        expect(sanitizeFilename('..hidden')).toBe('hidden');
        expect(sanitizeFilename('...hidden')).toBe('hidden');
    });

    it('truncates to 200 chars preserving extension', () => {
        const longName = 'a'.repeat(250) + '.html';
        const result = sanitizeFilename(longName);
        expect(result.length).toBeLessThanOrEqual(200);
        expect(result).toMatch(/\.html$/);
    });

    it('prefixes Windows reserved names', () => {
        expect(sanitizeFilename('CON')).toBe('_CON');
        expect(sanitizeFilename('PRN')).toBe('_PRN');
        expect(sanitizeFilename('AUX')).toBe('_AUX');
        expect(sanitizeFilename('NUL')).toBe('_NUL');
        expect(sanitizeFilename('COM1')).toBe('_COM1');
        expect(sanitizeFilename('LPT3')).toBe('_LPT3');
        expect(sanitizeFilename('CON.txt')).toBe('_CON.txt');
    });

    it('is case-insensitive for reserved names', () => {
        expect(sanitizeFilename('con')).toBe('_con');
        expect(sanitizeFilename('Con.log')).toBe('_Con.log');
    });

    it('returns "unnamed" for empty result', () => {
        expect(sanitizeFilename('')).toBe('unnamed');
        expect(sanitizeFilename('...')).toBe('unnamed');
    });
});

// ─── resolveFileWithinRoot ──────────────────────────────────────

describe('resolveFileWithinRoot', () => {
    it('resolves a file in root', async () => {
        const result = await resolveFileWithinRoot(tmpRoot, '/page.html');
        expect(result).not.toBeNull();
        expect(result!.realPath).toContain('page.html');
        await result!.handle.close();
    });

    it('resolves index.html for root path', async () => {
        const result = await resolveFileWithinRoot(tmpRoot, '/');
        expect(result).not.toBeNull();
        expect(result!.realPath).toContain('index.html');
        await result!.handle.close();
    });

    it('resolves nested file', async () => {
        const result = await resolveFileWithinRoot(tmpRoot, '/sub/nested.html');
        expect(result).not.toBeNull();
        expect(result!.realPath).toContain('nested.html');
        await result!.handle.close();
    });

    it('resolves index.html in subdirectory', async () => {
        const result = await resolveFileWithinRoot(tmpRoot, '/sub/');
        expect(result).not.toBeNull();
        expect(result!.realPath).toContain(path.join('sub', 'index.html'));
        await result!.handle.close();
    });

    it('returns null for non-existent file', async () => {
        const result = await resolveFileWithinRoot(tmpRoot, '/does-not-exist.html');
        expect(result).toBeNull();
    });

    it('blocks path traversal via ../', async () => {
        const result = await resolveFileWithinRoot(tmpRoot, '/../../../etc/passwd');
        expect(result).toBeNull();
    });

    it('blocks null byte injection', async () => {
        const result = await resolveFileWithinRoot(tmpRoot, '/page\0.html');
        expect(result).toBeNull();
    });

    it('returns null for empty directory without index.html', async () => {
        const result = await resolveFileWithinRoot(tmpRoot, '/empty-dir/');
        expect(result).toBeNull();
    });

    it('returns null for non-existent root directory', async () => {
        const result = await resolveFileWithinRoot('/nonexistent-root-dir-xyz', '/page.html');
        expect(result).toBeNull();
    });
});

// ─── PathTraversalError ─────────────────────────────────────────

describe('PathTraversalError', () => {
    it('is an Error subclass', () => {
        const err = new PathTraversalError('test');
        expect(err).toBeInstanceOf(Error);
        expect(err.name).toBe('PathTraversalError');
        expect(err.message).toContain('test');
        expect(err.message).toContain('Path traversal blocked');
    });
});
