// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { detectProjectType, detectPackageManager, getWorkspaceInfo, scanWorkspace, findFiles, resolveWorkspaceDirs, ensureDir, getSessionDir } from './workspace.js';

describe('Workspace — Phase 11', () => {

    describe('detectProjectType', () => {
        it('detects node project from package.json', () => {
            const type = detectProjectType(path.resolve(__dirname, '../..'));
            expect(type).toBe('node');
        });

        it('returns unknown for non-existent dir', () => {
            expect(detectProjectType('/tmp/nonexistent-dir-xyz')).toBe('unknown');
        });

        it('returns unknown for empty dir', () => {
            const tmpDir = '/tmp/coreblow-test-empty-' + Date.now();
            fs.mkdirSync(tmpDir, { recursive: true });
            try {
                expect(detectProjectType(tmpDir)).toBe('unknown');
            } finally {
                fs.rmSync(tmpDir, { recursive: true });
            }
        });
    });

    describe('detectPackageManager', () => {
        it('returns undefined when no lockfile present', () => {
            // gateway/ is a subdirectory — lockfile is at monorepo root
            const pm = detectPackageManager(path.resolve(__dirname, '../..'));
            expect(pm).toBeUndefined();
        });

        it('returns undefined for unknown dir', () => {
            expect(detectPackageManager('/tmp/nonexistent-xyz')).toBeUndefined();
        });
    });

    describe('getWorkspaceInfo', () => {
        it('returns workspace info for current project', () => {
            const info = getWorkspaceInfo(path.resolve(__dirname, '../..'));
            expect(info.projectType).toBe('node');
            expect(info.hasGit).toBe(true);
            expect(info.mainLanguage).toBe('TypeScript/JavaScript');
            expect(info.configFiles).toContain('package.json');
        });
    });

    describe('scanWorkspace', () => {
        it('scans current src directory', () => {
            const files = scanWorkspace(path.resolve(__dirname, '..'), { maxDepth: 1, maxFiles: 50 });
            expect(files.length).toBeGreaterThan(0);
        });

        it('respects maxFiles limit', () => {
            const files = scanWorkspace(path.resolve(__dirname, '..'), { maxFiles: 5 });
            expect(files.length).toBeLessThanOrEqual(5);
        });

        it('excludes node_modules', () => {
            const files = scanWorkspace(path.resolve(__dirname, '../..'), { maxDepth: 1 });
            expect(files.find(f => f.relativePath === 'node_modules')).toBeUndefined();
        });
    });

    describe('findFiles', () => {
        it('finds TypeScript files', () => {
            const files = findFiles(path.resolve(__dirname), '*.ts');
            expect(files.length).toBeGreaterThan(0);
            expect(files.every(f => f.endsWith('.ts'))).toBe(true);
        });
    });

    describe('resolveWorkspaceDirs', () => {
        it('resolves standard directories', () => {
            const dirs = resolveWorkspaceDirs('/tmp/test');
            expect(dirs.workspace).toBe('/tmp/test');
            expect(dirs.config).toContain('.coreblow');
        });
    });

    describe('ensureDir + getSessionDir', () => {
        it('creates session directory', () => {
            const tmpDir = `/tmp/coreblow-workspace-${Date.now()}`;
            const sessionDir = getSessionDir(tmpDir, 'test-session');
            expect(fs.existsSync(sessionDir)).toBe(true);
            expect(sessionDir).toContain('.coreblow/sessions/test-session');
            fs.rmSync(tmpDir, { recursive: true, force: true });
        });
    });
});
