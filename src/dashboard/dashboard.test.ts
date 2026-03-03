import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'node:fs';
import { ConfigGuard } from './config-guard.js';

// Mock node:fs for ConfigGuard (uses fs.promises and fs.existsSync)
const mockReadFile = vi.fn();
const mockWriteFile = vi.fn();
const mockCopyFile = vi.fn();
const mockExistsSync = vi.fn();

vi.mock('node:fs', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:fs')>();
    return {
        ...actual,
        existsSync: (...args: any[]) => mockExistsSync(...args),
        promises: {
            readFile: (...args: any[]) => mockReadFile(...args),
            writeFile: (...args: any[]) => mockWriteFile(...args),
            copyFile: (...args: any[]) => mockCopyFile(...args),
        },
        default: {
            ...actual,
            existsSync: (...args: any[]) => mockExistsSync(...args),
            promises: {
                readFile: (...args: any[]) => mockReadFile(...args),
                writeFile: (...args: any[]) => mockWriteFile(...args),
                copyFile: (...args: any[]) => mockCopyFile(...args),
            },
        },
    };
});

describe('Dashboard Module', () => {
    describe('config-guard.ts: ConfigGuard', () => {
        let guard: ConfigGuard;

        beforeEach(() => {
            vi.clearAllMocks();
            guard = new ConfigGuard();
        });

        it('loads config and returns hash', async () => {
            const configContent = JSON.stringify({ key: 'value' });
            mockReadFile.mockResolvedValue(configContent);

            const result = await guard.load('/config.json');
            expect(result.config).toEqual({ key: 'value' });
            expect(result.hash).toBeDefined();
            expect(result.hash.length).toBe(32); // MD5 hex
            expect(guard.getCurrentHash()).toBe(result.hash);
        });

        it('saves config when hash matches (no conflict)', async () => {
            // First load
            const original = JSON.stringify({ a: 1 });
            mockReadFile.mockResolvedValue(original);
            const { hash } = await guard.load('/config.json');

            // Save with matching hash
            mockExistsSync.mockReturnValue(true);
            mockWriteFile.mockResolvedValue(undefined);
            mockCopyFile.mockResolvedValue(undefined);

            const result = await guard.save('/config.json', { a: 2 }, hash);
            expect(result.ok).toBe(true);
            expect(result.hash).toBeDefined();
            expect(result.hash).not.toBe(hash); // hash changed after write
        });

        it('rejects save when hash conflicts', async () => {
            // Load returns one content
            const original = JSON.stringify({ a: 1 });
            mockReadFile.mockResolvedValue(original);
            const { hash } = await guard.load('/config.json');

            // But file has changed by the time we save
            const changed = JSON.stringify({ a: 999 });
            mockReadFile.mockResolvedValue(changed);

            const result = await guard.save('/config.json', { a: 2 }, hash);
            expect(result.ok).toBe(false);
            expect(result.error).toContain('modified by another session');
        });

        it('allows first write when file does not exist (ENOENT)', async () => {
            const enoent = new Error('File not found') as any;
            enoent.code = 'ENOENT';
            mockReadFile.mockRejectedValue(enoent);
            mockExistsSync.mockReturnValue(false);
            mockWriteFile.mockResolvedValue(undefined);

            const result = await guard.save('/config.json', { new: true }, 'any-hash');
            expect(result.ok).toBe(true);
        });

        it('getCurrentHash returns empty before load', () => {
            expect(guard.getCurrentHash()).toBe('');
        });
    });
});
