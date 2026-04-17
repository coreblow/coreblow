/**
 * CoreBlow — Scan Paths Unit Tests
 */
import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { isPathInside, extensionUsesSkippedScannerPath } from './scan-paths.js';

describe('isPathInside', () => {
    it('should return true for path inside base', () => {
        expect(isPathInside('/srv/app', '/srv/app/data/file.txt')).toBe(true);
    });

    it('should return true for base itself', () => {
        expect(isPathInside('/srv/app', '/srv/app')).toBe(true);
    });

    it('should return true for nested subdirectory', () => {
        expect(isPathInside('/srv/app', '/srv/app/a/b/c/d')).toBe(true);
    });

    it('should return false for path outside base', () => {
        expect(isPathInside('/srv/app', '/etc/passwd')).toBe(false);
    });

    it('should return false for sibling directory', () => {
        expect(isPathInside('/srv/app', '/srv/other')).toBe(false);
    });

    it('should return false for parent directory', () => {
        expect(isPathInside('/srv/app', '/srv')).toBe(false);
    });

    it('should handle traversal in candidate', () => {
        expect(isPathInside('/srv/app', '/srv/app/../other')).toBe(false);
    });

    it('should handle relative paths by resolving', () => {
        const base = path.resolve('/srv/app');
        const candidate = path.resolve('/srv/app/sub');
        expect(isPathInside(base, candidate)).toBe(true);
    });
});

describe('extensionUsesSkippedScannerPath', () => {
    it('should return true for node_modules path', () => {
        expect(extensionUsesSkippedScannerPath('node_modules/package/index.js')).toBe(true);
    });

    it('should return true for hidden directory', () => {
        expect(extensionUsesSkippedScannerPath('.git/config')).toBe(true);
    });

    it('should return true for .env', () => {
        expect(extensionUsesSkippedScannerPath('.env/something')).toBe(true);
    });

    it('should return false for normal path', () => {
        expect(extensionUsesSkippedScannerPath('src/index.ts')).toBe(false);
    });

    it('should return false for . directory', () => {
        expect(extensionUsesSkippedScannerPath('./src/file.ts')).toBe(false);
    });

    it('should return false for .. directory', () => {
        expect(extensionUsesSkippedScannerPath('../src/file.ts')).toBe(false);
    });

    it('should handle backslash separators', () => {
        expect(extensionUsesSkippedScannerPath('node_modules\\package\\index.js')).toBe(true);
    });

    it('should handle nested node_modules', () => {
        expect(extensionUsesSkippedScannerPath('packages/sub/node_modules/dep/file.js')).toBe(true);
    });
});
