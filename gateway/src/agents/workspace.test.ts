/**
 * Tests for CoreBlow Workspace Manager
 */

import { describe, it, expect } from 'vitest';
import * as path from 'node:path';
import {
    detectProjectType,
    detectPackageManager,
    getWorkspaceInfo,
    resolveWorkspaceDirs,
    ensureDir,
} from './workspace.js';

// Use the actual gateway project dir as test workspace
const GATEWAY_DIR = path.resolve(import.meta.dirname, '../../');

describe('detectProjectType', () => {
    it('should detect node project by package.json', () => {
        expect(detectProjectType(GATEWAY_DIR)).toBe('node');
    });

    it('should return unknown for non-project dirs', () => {
        expect(detectProjectType('/tmp')).toBe('unknown');
    });

    it('should return unknown for nonexistent dirs', () => {
        expect(detectProjectType('/nonexistent-dir-12345')).toBe('unknown');
    });
});

describe('detectPackageManager', () => {
    it('should detect package manager in gateway project', () => {
        const pm = detectPackageManager(GATEWAY_DIR);
        // Should detect one of the common managers
        expect(['npm', 'yarn', 'pnpm', 'bun', undefined]).toContain(pm);
    });

    it('should return undefined for non-node dirs', () => {
        expect(detectPackageManager('/tmp')).toBeUndefined();
    });
});

describe('getWorkspaceInfo', () => {
    it('should get comprehensive workspace info', () => {
        const info = getWorkspaceInfo(GATEWAY_DIR);
        expect(info.path).toBe(path.resolve(GATEWAY_DIR));
        expect(info.projectType).toBe('node');
        expect(info.configFiles).toContain('package.json');
        expect(info.mainLanguage).toContain('Script'); // TypeScript/JavaScript
    });

    it('should include workspace exists', () => {
        const info = getWorkspaceInfo(GATEWAY_DIR);
        expect(info.exists).toBe(true);
        expect(info.hasGit).toBe(true);
    });
});

describe('resolveWorkspaceDirs', () => {
    it('should resolve workspace directories', () => {
        const dirs = resolveWorkspaceDirs(GATEWAY_DIR);
        expect(dirs.workspace).toBe(path.resolve(GATEWAY_DIR));
        expect(dirs.config).toContain('.coreblow');
        expect(dirs.sessions).toContain('sessions');
        expect(dirs.logs).toContain('logs');
    });
});
