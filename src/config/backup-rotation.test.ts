import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    CONFIG_BACKUP_COUNT,
    rotateConfigBackups,
    hardenBackupPermissions,
    cleanOrphanBackups,
    maintainConfigBackups,
    type BackupRotationFs,
    type BackupMaintenanceFs,
} from './backup-rotation.js';

function createMockFs(): BackupRotationFs & {
    unlinkCalls: string[];
    renameCalls: Array<[string, string]>;
    chmodCalls: Array<[string, number]>;
    readdirResult: string[];
} {
    const fs = {
        unlinkCalls: [] as string[],
        renameCalls: [] as Array<[string, string]>,
        chmodCalls: [] as Array<[string, number]>,
        readdirResult: [] as string[],
        unlink: async (path: string) => { fs.unlinkCalls.push(path); },
        rename: async (from: string, to: string) => { fs.renameCalls.push([from, to]); },
        chmod: async (path: string, mode: number) => { fs.chmodCalls.push([path, mode]); },
        readdir: async () => fs.readdirResult,
    };
    return fs;
}

const CFG_PATH = '/home/user/.coreblow/coreblow.json';

describe('CONFIG_BACKUP_COUNT', () => {
    it('is 5', () => {
        expect(CONFIG_BACKUP_COUNT).toBe(5);
    });
});

describe('rotateConfigBackups', () => {
    it('deletes the oldest backup', async () => {
        const fs = createMockFs();
        await rotateConfigBackups(CFG_PATH, fs);
        // Should try to unlink .bak.4 (maxIndex = 4)
        expect(fs.unlinkCalls).toContain(`${CFG_PATH}.bak.4`);
    });

    it('renames numbered backups in reverse order', async () => {
        const fs = createMockFs();
        await rotateConfigBackups(CFG_PATH, fs);
        // Should rename .bak.3 → .bak.4, .bak.2 → .bak.3, .bak.1 → .bak.2
        expect(fs.renameCalls).toContainEqual([`${CFG_PATH}.bak.3`, `${CFG_PATH}.bak.4`]);
        expect(fs.renameCalls).toContainEqual([`${CFG_PATH}.bak.2`, `${CFG_PATH}.bak.3`]);
        expect(fs.renameCalls).toContainEqual([`${CFG_PATH}.bak.1`, `${CFG_PATH}.bak.2`]);
    });

    it('renames primary .bak to .bak.1', async () => {
        const fs = createMockFs();
        await rotateConfigBackups(CFG_PATH, fs);
        expect(fs.renameCalls).toContainEqual([`${CFG_PATH}.bak`, `${CFG_PATH}.bak.1`]);
    });

    it('handles errors gracefully (best-effort)', async () => {
        const fs = createMockFs();
        fs.unlink = async () => { throw new Error('ENOENT'); };
        fs.rename = async () => { throw new Error('ENOENT'); };
        // Should not throw
        await expect(rotateConfigBackups(CFG_PATH, fs)).resolves.toBeUndefined();
    });
});

describe('hardenBackupPermissions', () => {
    it('chmods primary and numbered backups to 0o600', async () => {
        const fs = createMockFs();
        await hardenBackupPermissions(CFG_PATH, fs);
        // Primary .bak + .bak.1 through .bak.4
        expect(fs.chmodCalls.length).toBe(CONFIG_BACKUP_COUNT);
        for (const [, mode] of fs.chmodCalls) {
            expect(mode).toBe(0o600);
        }
    });

    it('skips when chmod not available', async () => {
        const fs = createMockFs();
        delete (fs as any).chmod;
        await expect(hardenBackupPermissions(CFG_PATH, fs)).resolves.toBeUndefined();
    });
});

describe('cleanOrphanBackups', () => {
    it('removes orphan .bak files outside rotation ring', async () => {
        const fs = createMockFs();
        fs.readdirResult = [
            'coreblow.json',           // not a bak
            'coreblow.json.bak',        // primary bak (no suffix → not matched by prefix)
            'coreblow.json.bak.1',      // valid
            'coreblow.json.bak.2',      // valid
            'coreblow.json.bak.99',     // orphan
            'coreblow.json.bak.old',    // orphan
            'coreblow.json.bak.1772352289', // orphan (PID-stamped)
        ];
        await cleanOrphanBackups(CFG_PATH, fs);
        expect(fs.unlinkCalls).toHaveLength(3); // 99, old, PID
    });

    it('preserves valid numbered backups', async () => {
        const fs = createMockFs();
        fs.readdirResult = ['coreblow.json.bak.1', 'coreblow.json.bak.2', 'coreblow.json.bak.3', 'coreblow.json.bak.4'];
        await cleanOrphanBackups(CFG_PATH, fs);
        expect(fs.unlinkCalls).toHaveLength(0);
    });

    it('skips when readdir not available', async () => {
        const fs = createMockFs();
        delete (fs as any).readdir;
        await expect(cleanOrphanBackups(CFG_PATH, fs)).resolves.toBeUndefined();
    });
});

describe('maintainConfigBackups', () => {
    it('runs full cycle: rotate → copy → harden → clean', async () => {
        const ops: string[] = [];
        const mockFs: BackupMaintenanceFs = {
            unlink: async () => { ops.push('unlink'); },
            rename: async () => { ops.push('rename'); },
            chmod: async () => { ops.push('chmod'); },
            readdir: async () => { ops.push('readdir'); return []; },
            copyFile: async () => { ops.push('copy'); },
        };
        await maintainConfigBackups(CFG_PATH, mockFs);
        // Verify ops happened in order: renames first, then copy, then chmod, then readdir
        const copyIdx = ops.indexOf('copy');
        const firstChmod = ops.indexOf('chmod');
        expect(copyIdx).toBeGreaterThan(-1);
        expect(firstChmod).toBeGreaterThan(copyIdx);
    });
});
