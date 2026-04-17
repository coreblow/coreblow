/**
 * CoreBlow Security — SafePath Test Suite
 *
 * Covers: resolveSafePath(), isWithinBase(), safeJoin(),
 * hasTraversalComponents(), createPathResolver(), path traversal
 * prevention, null byte injection, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
    resolveSafePath,
    isWithinBase,
    safeJoin,
    hasTraversalComponents,
    createPathResolver,
} from './safe-path.js';

const BASE = '/home/user/data';

describe('resolveSafePath()', () => {
    it('resolves a safe relative path', () => {
        const result = resolveSafePath(BASE, 'file.txt');
        expect(result).toBe(path.resolve(BASE, 'file.txt'));
    });

    it('resolves nested safe path', () => {
        const result = resolveSafePath(BASE, 'subdir/file.txt');
        expect(result).toBe(path.resolve(BASE, 'subdir/file.txt'));
    });

    it('returns null for path traversal (../)', () => {
        const result = resolveSafePath(BASE, '../../../etc/passwd');
        expect(result).toBeNull();
    });

    it('returns null for absolute path escape', () => {
        const result = resolveSafePath(BASE, '/etc/passwd');
        expect(result).toBeNull();
    });

    it('strips null bytes', () => {
        const result = resolveSafePath(BASE, 'file\0.txt');
        expect(result).toBe(path.resolve(BASE, 'file.txt'));
    });

    it('allows resolving the base directory itself', () => {
        const result = resolveSafePath(BASE, '.');
        expect(result).toBe(path.resolve(BASE));
    });

    it('throws Error for non-absolute base', () => {
        expect(() => resolveSafePath('relative/base', 'file.txt')).toThrow('Base path must be absolute');
    });

    it('throws Error for empty base', () => {
        expect(() => resolveSafePath('', 'file.txt')).toThrow();
    });

    it('handles complex traversal attempts', () => {
        expect(resolveSafePath(BASE, 'a/../../..')).toBeNull();
        expect(resolveSafePath(BASE, './a/../../../etc')).toBeNull();
    });
});

describe('isWithinBase()', () => {
    it('returns true for path within base', () => {
        expect(isWithinBase(BASE, path.join(BASE, 'subdir/file.txt'))).toBe(true);
    });

    it('returns true for the base directory itself', () => {
        expect(isWithinBase(BASE, BASE)).toBe(true);
    });

    it('returns false for path outside base', () => {
        expect(isWithinBase(BASE, '/etc/passwd')).toBe(false);
    });

    it('returns false for sibling directory', () => {
        expect(isWithinBase(BASE, '/home/user/other')).toBe(false);
    });
});

describe('safeJoin()', () => {
    it('joins safe segments', () => {
        const result = safeJoin(BASE, 'subdir', 'file.txt');
        expect(result).toBe(path.resolve(BASE, 'subdir', 'file.txt'));
    });

    it('returns null if segments escape boundary', () => {
        const result = safeJoin(BASE, '..', '..', 'etc', 'passwd');
        expect(result).toBeNull();
    });
});

describe('hasTraversalComponents()', () => {
    it('detects .. component', () => {
        expect(hasTraversalComponents('../etc/passwd')).toBe(true);
        expect(hasTraversalComponents('a/../../b')).toBe(true);
    });

    it('detects . component', () => {
        expect(hasTraversalComponents('./file.txt')).toBe(true);
    });

    it('detects null bytes', () => {
        expect(hasTraversalComponents('file\0.txt')).toBe(true);
    });

    it('returns false for safe paths', () => {
        expect(hasTraversalComponents('subdir/file.txt')).toBe(false);
        expect(hasTraversalComponents('my.file.name')).toBe(false);
    });

    it('handles Windows backslash separators', () => {
        expect(hasTraversalComponents('..\\windows\\system32')).toBe(true);
    });
});

describe('createPathResolver()', () => {
    it('creates a resolver bound to base', () => {
        const resolver = createPathResolver(BASE);
        expect(resolver.base).toBe(path.resolve(BASE));
    });

    it('resolve() works for safe paths', () => {
        const resolver = createPathResolver(BASE);
        const result = resolver.resolve('file.txt');
        expect(result).toBe(path.resolve(BASE, 'file.txt'));
    });

    it('resolve() returns null for traversal', () => {
        const resolver = createPathResolver(BASE);
        expect(resolver.resolve('../../../etc/passwd')).toBeNull();
    });

    it('isWithin() checks boundary', () => {
        const resolver = createPathResolver(BASE);
        expect(resolver.isWithin(path.join(BASE, 'safe'))).toBe(true);
        expect(resolver.isWithin('/etc/bad')).toBe(false);
    });

    it('join() works for safe segments', () => {
        const resolver = createPathResolver(BASE);
        const result = resolver.join('a', 'b', 'c.txt');
        expect(result).toBe(path.resolve(BASE, 'a', 'b', 'c.txt'));
    });

    it('join() returns null for dangerous segments', () => {
        const resolver = createPathResolver(BASE);
        expect(resolver.join('..', '..', '..', 'etc')).toBeNull();
    });
});
