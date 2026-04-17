/**
 * CoreBlow — Safe Path Resolution Unit Tests
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { resolveSafePath, isWithinBase, safeJoin, hasTraversalComponents, createPathResolver } from './safe-path.js';

const BASE = '/srv/app/data';

describe('resolveSafePath', () => {
    // ─── Valid Paths ─────────────────────────────────────────────

    describe('valid paths', () => {
        it('should resolve a simple filename within base', () => {
            const result = resolveSafePath(BASE, 'file.txt');
            expect(result).toBe(path.resolve(BASE, 'file.txt'));
        });

        it('should resolve a subdirectory path', () => {
            const result = resolveSafePath(BASE, 'sub/dir/file.txt');
            expect(result).toBe(path.resolve(BASE, 'sub/dir/file.txt'));
        });

        it('should resolve dot (current dir) to base itself', () => {
            const result = resolveSafePath(BASE, '.');
            expect(result).toBe(path.resolve(BASE));
        });

        it('should resolve empty string to base', () => {
            const result = resolveSafePath(BASE, '');
            expect(result).toBe(path.resolve(BASE));
        });

        it('should strip null bytes from input', () => {
            const result = resolveSafePath(BASE, 'file\0.txt');
            expect(result).toBe(path.resolve(BASE, 'file.txt'));
        });
    });

    // ─── Path Traversal Prevention ───────────────────────────────

    describe('traversal prevention', () => {
        it('should reject ../ traversal beyond base', () => {
            const result = resolveSafePath(BASE, '../../../etc/passwd');
            expect(result).toBeNull();
        });

        it('should reject absolute path outside base', () => {
            const result = resolveSafePath(BASE, '/etc/passwd');
            expect(result).toBeNull();
        });

        it('should allow ../ that stays within base', () => {
            const result = resolveSafePath(BASE, 'sub/../file.txt');
            expect(result).toBe(path.resolve(BASE, 'file.txt'));
        });
    });

    // ─── Error Handling ──────────────────────────────────────────

    describe('error handling', () => {
        it('should throw for empty base', () => {
            expect(() => resolveSafePath('', 'file.txt')).toThrow('Base path must be absolute');
        });

        it('should throw for relative base', () => {
            expect(() => resolveSafePath('./relative', 'file.txt')).toThrow('Base path must be absolute');
        });
    });
});

describe('isWithinBase', () => {
    it('should return true for path within base', () => {
        expect(isWithinBase(BASE, '/srv/app/data/file.txt')).toBe(true);
    });

    it('should return true for base itself', () => {
        expect(isWithinBase(BASE, BASE)).toBe(true);
    });

    it('should return false for path outside base', () => {
        expect(isWithinBase(BASE, '/etc/passwd')).toBe(false);
    });

    it('should return false for sibling directory', () => {
        expect(isWithinBase(BASE, '/srv/app/other/file.txt')).toBe(false);
    });
});

describe('safeJoin', () => {
    it('should join segments safely within base', () => {
        const result = safeJoin(BASE, 'sub', 'file.txt');
        expect(result).toBe(path.resolve(BASE, 'sub/file.txt'));
    });

    it('should reject joins that escape base', () => {
        const result = safeJoin(BASE, '..', '..', 'etc', 'passwd');
        expect(result).toBeNull();
    });
});

describe('hasTraversalComponents', () => {
    it('should detect .. components', () => {
        expect(hasTraversalComponents('../etc/passwd')).toBe(true);
    });

    it('should detect . components', () => {
        expect(hasTraversalComponents('./file.txt')).toBe(true);
    });

    it('should detect null bytes', () => {
        expect(hasTraversalComponents('file\0.txt')).toBe(true);
    });

    it('should return false for safe paths', () => {
        expect(hasTraversalComponents('sub/dir/file.txt')).toBe(false);
    });

    it('should handle backslash separators', () => {
        expect(hasTraversalComponents('..\\windows\\system32')).toBe(true);
    });
});

describe('createPathResolver', () => {
    it('should create a resolver bound to base', () => {
        const resolver = createPathResolver(BASE);
        expect(resolver.base).toBe(path.resolve(BASE));
    });

    it('resolve should work for safe paths', () => {
        const resolver = createPathResolver(BASE);
        expect(resolver.resolve('file.txt')).toBe(path.resolve(BASE, 'file.txt'));
    });

    it('resolve should reject traversal', () => {
        const resolver = createPathResolver(BASE);
        expect(resolver.resolve('../../../etc/passwd')).toBeNull();
    });

    it('isWithin should check paths', () => {
        const resolver = createPathResolver(BASE);
        expect(resolver.isWithin(path.resolve(BASE, 'sub/file'))).toBe(true);
        expect(resolver.isWithin('/etc/passwd')).toBe(false);
    });

    it('join should work safely', () => {
        const resolver = createPathResolver(BASE);
        expect(resolver.join('sub', 'file.txt')).toBe(path.resolve(BASE, 'sub/file.txt'));
    });
});
