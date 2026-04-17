/**
 * Safe Open + Boundary File Read Tests
 *
 * Validates OpenClaw security pattern port:
 *   - openVerifiedFileSync: O_NOFOLLOW, hardlink rejection, TOCTOU, maxBytes
 *   - readBoundaryFileSync: boundary path check, symlink escape, integration
 *   - sameFileIdentity: inode comparison
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { openVerifiedFileSync } from './safe-open.js';
import { readBoundaryFileSync } from './boundary-file-read.js';
import { sameFileIdentity } from './file-identity.js';

function createTmpDir(): string {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'coreblow-safe-open-'));
}

function removeTmpDir(dir: string): void {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ok */ }
}

describe('sameFileIdentity', () => {
    let tmpDir: string;
    beforeEach(() => { tmpDir = createTmpDir(); });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('returns true for same file', () => {
        const file = path.join(tmpDir, 'test.txt');
        fs.writeFileSync(file, 'hello');
        const stat1 = fs.statSync(file);
        const stat2 = fs.statSync(file);
        expect(sameFileIdentity(stat1, stat2)).toBe(true);
    });

    it('returns false for different files', () => {
        const file1 = path.join(tmpDir, 'a.txt');
        const file2 = path.join(tmpDir, 'b.txt');
        fs.writeFileSync(file1, 'hello');
        fs.writeFileSync(file2, 'world');
        const stat1 = fs.statSync(file1);
        const stat2 = fs.statSync(file2);
        expect(sameFileIdentity(stat1, stat2)).toBe(false);
    });
});

describe('openVerifiedFileSync', () => {
    let tmpDir: string;
    beforeEach(() => { tmpDir = createTmpDir(); });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('opens a regular file successfully', () => {
        const file = path.join(tmpDir, 'normal.json');
        fs.writeFileSync(file, '{"name":"test"}');

        const result = openVerifiedFileSync({ filePath: file });
        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(result.stat.isFile()).toBe(true);
            const content = fs.readFileSync(result.fd, 'utf-8');
            fs.closeSync(result.fd);
            expect(content).toBe('{"name":"test"}');
        }
    });

    it('rejects symlinks when rejectPathSymlink is true', () => {
        const real = path.join(tmpDir, 'real.txt');
        const link = path.join(tmpDir, 'link.txt');
        fs.writeFileSync(real, 'secret');
        fs.symlinkSync(real, link);

        const result = openVerifiedFileSync({
            filePath: link,
            rejectPathSymlink: true,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('validation');
        }
    });

    it('rejects hardlinks when rejectHardlinks is true', () => {
        const file = path.join(tmpDir, 'original.txt');
        const hardlink = path.join(tmpDir, 'hardlink.txt');
        fs.writeFileSync(file, 'data');
        fs.linkSync(file, hardlink);

        // original now has nlink=2
        const result = openVerifiedFileSync({
            filePath: file,
            rejectHardlinks: true,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('validation');
        }
    });

    it('rejects files exceeding maxBytes', () => {
        const file = path.join(tmpDir, 'large.txt');
        fs.writeFileSync(file, 'x'.repeat(1000));

        const result = openVerifiedFileSync({
            filePath: file,
            maxBytes: 100,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('validation');
        }
    });

    it('rejects directory when allowedType is file', () => {
        const dir = path.join(tmpDir, 'subdir');
        fs.mkdirSync(dir);

        const result = openVerifiedFileSync({
            filePath: dir,
            allowedType: 'file',
        });
        expect(result.ok).toBe(false);
    });

    it('returns path error for missing file', () => {
        const result = openVerifiedFileSync({
            filePath: path.join(tmpDir, 'nonexistent.txt'),
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.reason).toBe('path');
        }
    });
});

describe('readBoundaryFileSync', () => {
    let tmpDir: string;
    let pluginRoot: string;
    beforeEach(() => {
        tmpDir = createTmpDir();
        pluginRoot = path.join(tmpDir, 'plugins', 'my-plugin');
        fs.mkdirSync(pluginRoot, { recursive: true });
    });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('reads file inside plugin root', () => {
        const manifest = path.join(pluginRoot, 'plugin.json');
        fs.writeFileSync(manifest, '{"name":"@test/plugin","version":"1.0.0"}');

        const result = readBoundaryFileSync({
            filePath: manifest,
            rootDir: pluginRoot,
            boundaryLabel: 'test',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            const parsed = JSON.parse(result.content);
            expect(parsed.name).toBe('@test/plugin');
        }
    });

    it('rejects symlink that escapes plugin root', () => {
        // Create sensitive file outside plugin root
        const secret = path.join(tmpDir, 'secret.txt');
        fs.writeFileSync(secret, 'API_KEY=sk_12345');

        // Create symlink inside plugin root pointing outside
        const link = path.join(pluginRoot, 'plugin.json');
        fs.symlinkSync(secret, link);

        const result = readBoundaryFileSync({
            filePath: link,
            rootDir: pluginRoot,
            boundaryLabel: 'test',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('symlink escape');
        }
    });

    it('rejects path outside plugin root', () => {
        const outside = path.join(tmpDir, 'outside.json');
        fs.writeFileSync(outside, '{"evil":true}');

        const result = readBoundaryFileSync({
            filePath: outside,
            rootDir: pluginRoot,
            boundaryLabel: 'test',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('escapes boundary');
        }
    });

    it('rejects path traversal (../)', () => {
        const traversal = path.join(pluginRoot, '..', '..', 'secret.txt');
        const secret = path.join(tmpDir, 'secret.txt');
        fs.writeFileSync(secret, 'sensitive');

        const result = readBoundaryFileSync({
            filePath: traversal,
            rootDir: pluginRoot,
            boundaryLabel: 'test',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('escape');
        }
    });

    it('rejects hardlinked manifest', () => {
        // Create original file
        const original = path.join(tmpDir, 'original.json');
        fs.writeFileSync(original, '{"name":"evil"}');

        // Create hardlink inside plugin root
        const hardlink = path.join(pluginRoot, 'plugin.json');
        fs.linkSync(original, hardlink);

        const result = readBoundaryFileSync({
            filePath: hardlink,
            rootDir: pluginRoot,
            boundaryLabel: 'test',
            rejectHardlinks: true,
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('validation failed');
        }
    });

    it('rejects oversized manifest', () => {
        const manifest = path.join(pluginRoot, 'plugin.json');
        fs.writeFileSync(manifest, 'x'.repeat(2_000_000)); // 2MB

        const result = readBoundaryFileSync({
            filePath: manifest,
            rootDir: pluginRoot,
            boundaryLabel: 'test',
            maxBytes: 1_048_576, // 1MB
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('validation failed');
        }
    });

    it('returns error for nonexistent root', () => {
        const result = readBoundaryFileSync({
            filePath: '/tmp/some/file.json',
            rootDir: '/tmp/nonexistent-root-' + Date.now(),
            boundaryLabel: 'test',
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error).toContain('root dir not found');
        }
    });

    it('reads nested file inside plugin root', () => {
        const subDir = path.join(pluginRoot, 'config');
        fs.mkdirSync(subDir);
        const nested = path.join(subDir, 'settings.json');
        fs.writeFileSync(nested, '{"debug":true}');

        const result = readBoundaryFileSync({
            filePath: nested,
            rootDir: pluginRoot,
            boundaryLabel: 'test',
        });

        expect(result.ok).toBe(true);
        if (result.ok) {
            expect(JSON.parse(result.content).debug).toBe(true);
        }
    });
});

describe('integration: manifest.ts uses boundary read', () => {
    let tmpDir: string;
    beforeEach(() => { tmpDir = createTmpDir(); });
    afterEach(() => { removeTmpDir(tmpDir); });

    it('parseManifest rejects symlink manifest', async () => {
        const pluginDir = path.join(tmpDir, 'evil-plugin');
        fs.mkdirSync(pluginDir, { recursive: true });

        // Create target outside
        const target = path.join(tmpDir, 'fake-manifest.json');
        fs.writeFileSync(target, JSON.stringify({
            name: 'evil',
            version: '1.0.0',
            description: 'evil plugin',
            main: 'index.js',
        }));

        // Symlink plugin.json to outside
        fs.symlinkSync(target, path.join(pluginDir, 'plugin.json'));

        // parseManifest should reject
        const { parseManifest } = await import('../plugins/manifest.js');
        const result = parseManifest(pluginDir);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.includes('symlink escape') || e.includes('validation failed'))).toBe(true);
    });
});
