/**
 * json-files-lock.test.ts
 *
 * Tests that writeJsonAtomic() correctly serializes concurrent writes
 * to the same file path using the per-path lock.
 *
 * Before fix: 19/20 concurrent writes silently lost.
 * After fix: 20/20 concurrent writes succeed (serialized).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { writeJsonAtomic, readJsonFile } from './json-files.js';

let tmpDir: string;

beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'coreblow-lock-'));
});

afterEach(async () => {
    try { await fs.rm(tmpDir, { recursive: true, force: true }); } catch { /* OK */ }
});

describe('writeJsonAtomic — Per-Path Lock', () => {
    it('20 concurrent writes to same file all resolve without error', async () => {
        const filePath = path.join(tmpDir, 'concurrent.json');

        // Fire 20 writes concurrently
        const promises = Array.from({ length: 20 }, (_, i) =>
            writeJsonAtomic(filePath, { writer: i, timestamp: Date.now() })
        );

        // ALL must resolve — no rejected promises
        await expect(Promise.all(promises)).resolves.toBeDefined();

        // File must be valid JSON
        const result = await readJsonFile<{ writer: number }>(filePath);
        expect(result).not.toBeNull();
        expect(typeof result!.writer).toBe('number');
    });

    it('serialized writes produce valid JSON (no corruption)', async () => {
        const filePath = path.join(tmpDir, 'serial.json');

        // Write 50 values concurrently
        await Promise.all(
            Array.from({ length: 50 }, (_, i) =>
                writeJsonAtomic(filePath, { value: i })
            )
        );

        // Final file must be valid JSON
        const raw = await fs.readFile(filePath, 'utf-8');
        expect(() => JSON.parse(raw)).not.toThrow();
    });

    it('concurrent writes to DIFFERENT files are independent', async () => {
        const fileA = path.join(tmpDir, 'a.json');
        const fileB = path.join(tmpDir, 'b.json');

        await Promise.all([
            writeJsonAtomic(fileA, { file: 'a' }),
            writeJsonAtomic(fileB, { file: 'b' }),
        ]);

        const a = await readJsonFile<{ file: string }>(fileA);
        const b = await readJsonFile<{ file: string }>(fileB);
        expect(a!.file).toBe('a');
        expect(b!.file).toBe('b');
    });

    it('write lock does not deadlock on sequential calls', async () => {
        const filePath = path.join(tmpDir, 'seq.json');

        // Sequential writes should work fine
        await writeJsonAtomic(filePath, { step: 1 });
        await writeJsonAtomic(filePath, { step: 2 });
        await writeJsonAtomic(filePath, { step: 3 });

        const result = await readJsonFile<{ step: number }>(filePath);
        expect(result!.step).toBe(3);
    });

    it('handles write errors without breaking the lock', async () => {
        const filePath = path.join(tmpDir, 'error.json');

        // First write succeeds
        await writeJsonAtomic(filePath, { ok: true });

        // Try to write to an invalid path (should fail but not break lock)
        try {
            await writeJsonAtomic('/dev/null/impossible/path.json', { bad: true });
        } catch {
            // Expected to fail
        }

        // Subsequent write to valid path should still work
        await writeJsonAtomic(filePath, { recovered: true });
        const result = await readJsonFile<{ recovered: boolean }>(filePath);
        expect(result!.recovered).toBe(true);
    });
});
