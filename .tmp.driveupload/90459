/** Test helper for state directory */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
export function setupTestStateDir(): string { const dir = path.join(os.tmpdir(), `coreblow-test-${Date.now()}`); fs.mkdirSync(dir, { recursive: true }); return dir; }
export function cleanupTestStateDir(dir: string): void { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }


export function withStateDirEnv<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
    const dir = setupTestStateDir();
    return Promise.resolve(fn(dir)).finally(() => cleanupTestStateDir(dir));
}
