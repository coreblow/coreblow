import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ConfigGuard } from './config-guard.js';

let tmpDir: string;
let configPath: string;

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cb-dashboard-test-'));
    configPath = path.join(tmpDir, 'config.json');
});

afterAll(async () => {
    // Cleanup any remaining temp dirs
    try {
        if (tmpDir) await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {}
});

describe('ConfigGuard', () => {
    describe('load', () => {
        it('loads config and returns hash', async () => {
            const data = { name: 'coreblow', port: 3000 };
            await fs.writeFile(configPath, JSON.stringify(data));

            const guard = new ConfigGuard();
            const { config, hash } = await guard.load(configPath);
            expect(config).toEqual(data);
            expect(hash).toBeTruthy();
            expect(hash).toHaveLength(32); // MD5 hex
        });

        it('returns consistent hash for same content', async () => {
            await fs.writeFile(configPath, '{"key":"value"}');

            const guard1 = new ConfigGuard();
            const guard2 = new ConfigGuard();
            const r1 = await guard1.load(configPath);
            const r2 = await guard2.load(configPath);
            expect(r1.hash).toBe(r2.hash);
        });

        it('returns different hash for different content', async () => {
            await fs.writeFile(configPath, '{"a":1}');
            const guard = new ConfigGuard();
            const r1 = await guard.load(configPath);

            await fs.writeFile(configPath, '{"a":2}');
            const r2 = await guard.load(configPath);
            expect(r1.hash).not.toBe(r2.hash);
        });

        it('throws for non-existent file', async () => {
            const guard = new ConfigGuard();
            await expect(guard.load('/nonexistent/config.json')).rejects.toThrow();
        });
    });

    describe('save — happy path', () => {
        it('saves config when hash matches', async () => {
            const original = { name: 'coreblow' };
            await fs.writeFile(configPath, JSON.stringify(original));

            const guard = new ConfigGuard();
            const { hash } = await guard.load(configPath);

            const updated = { name: 'coreblow', version: 2 };
            const result = await guard.save(configPath, updated, hash);
            expect(result.ok).toBe(true);
            expect(result.hash).toBeTruthy();

            // Verify file was written
            const content = JSON.parse(await fs.readFile(configPath, 'utf-8'));
            expect(content.version).toBe(2);
        });

        it('updates getCurrentHash after save', async () => {
            await fs.writeFile(configPath, '{"a":1}');

            const guard = new ConfigGuard();
            const { hash: oldHash } = await guard.load(configPath);
            const result = await guard.save(configPath, { a: 2 }, oldHash);

            expect(result.ok).toBe(true);
            expect(guard.getCurrentHash()).toBe(result.hash);
            expect(guard.getCurrentHash()).not.toBe(oldHash);
        });

        it('creates backup file before overwrite', async () => {
            await fs.writeFile(configPath, '{"original":true}');

            const guard = new ConfigGuard();
            const { hash } = await guard.load(configPath);
            await guard.save(configPath, { updated: true }, hash);

            const backupPath = configPath + '.backup';
            const backup = JSON.parse(await fs.readFile(backupPath, 'utf-8'));
            expect(backup.original).toBe(true);
        });

        it('formats output with 2-space indent', async () => {
            await fs.writeFile(configPath, '{}');

            const guard = new ConfigGuard();
            const { hash } = await guard.load(configPath);
            await guard.save(configPath, { nested: { key: 'value' } }, hash);

            const raw = await fs.readFile(configPath, 'utf-8');
            expect(raw).toContain('  "nested"');
        });
    });

    describe('save — conflict detection', () => {
        it('rejects save when file was modified externally', async () => {
            await fs.writeFile(configPath, '{"v":1}');

            const guard = new ConfigGuard();
            const { hash } = await guard.load(configPath);

            // External edit
            await fs.writeFile(configPath, '{"v":2,"external":true}');

            const result = await guard.save(configPath, { v: 3 }, hash);
            expect(result.ok).toBe(false);
            expect(result.error).toContain('modified by another session');
        });

        it('rejects with wrong hash', async () => {
            await fs.writeFile(configPath, '{"a":1}');

            const guard = new ConfigGuard();
            const result = await guard.save(configPath, { a: 2 }, 'wrong-hash');
            expect(result.ok).toBe(false);
            expect(result.error).toContain('modified');
        });
    });

    describe('save — first write (no existing file)', () => {
        it('allows save when file does not exist', async () => {
            const newPath = path.join(tmpDir, 'new-config.json');
            const guard = new ConfigGuard();
            const result = await guard.save(newPath, { fresh: true }, 'any-hash');
            expect(result.ok).toBe(true);

            const content = JSON.parse(await fs.readFile(newPath, 'utf-8'));
            expect(content.fresh).toBe(true);
        });
    });

    describe('getCurrentHash', () => {
        it('returns empty string before any load', () => {
            const guard = new ConfigGuard();
            expect(guard.getCurrentHash()).toBe('');
        });

        it('returns hash after load', async () => {
            await fs.writeFile(configPath, '{}');

            const guard = new ConfigGuard();
            await guard.load(configPath);
            expect(guard.getCurrentHash()).toHaveLength(32);
        });
    });
});
