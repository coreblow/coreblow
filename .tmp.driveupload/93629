/**
 * Tests: CLI Core — Auth Store, Config Store, PID File, Notification
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ═══════════════════════════════════════════════════════════════
// AUTH STORE
// ═══════════════════════════════════════════════════════════════

import { AuthStore } from '../../src/cli/auth/auth-store.js';

describe('AuthStore', () => {
    let store: AuthStore;
    let tmpFile: string;

    beforeEach(() => {
        tmpFile = path.join(os.tmpdir(), `auth-test-${Date.now()}.txt`);
        store = new AuthStore(tmpFile);
    });

    afterEach(() => {
        try { fs.unlinkSync(tmpFile); } catch { /* intentionally ignored */ }
    });

    it('saves and loads a token', () => {
        store.save('test-token-abc123');
        expect(store.load()).toBe('test-token-abc123');
    });

    it('returns null when no token saved', () => {
        expect(store.load()).toBeNull();
    });

    it('overwrites existing token', () => {
        store.save('old-token');
        store.save('new-token');
        expect(store.load()).toBe('new-token');
    });

    it('clears stored token', () => {
        store.save('token-to-clear');
        store.clear();
        expect(store.load()).toBeNull();
    });

    it('clear is safe when no file exists', () => {
        expect(() => store.clear()).not.toThrow();
    });

    it('trims whitespace from loaded token', () => {
        fs.writeFileSync(tmpFile, '  token-with-spaces  \n');
        expect(store.load()).toBe('token-with-spaces');
    });
});

// ═══════════════════════════════════════════════════════════════
// CLI CONFIG STORE
// ═══════════════════════════════════════════════════════════════

import { CLIConfigStore } from '../../src/cli/config/cli-config-store.js';

describe('CLIConfigStore', () => {
    let store: CLIConfigStore;
    let tmpFile: string;

    beforeEach(() => {
        tmpFile = path.join(os.tmpdir(), `cli-config-${Date.now()}.json`);
        store = new CLIConfigStore(tmpFile);
    });

    afterEach(() => {
        try { fs.unlinkSync(tmpFile); } catch { /* intentionally ignored */ }
    });

    it('saves and loads config', () => {
        store.save({ model: 'gpt-4', port: 3000 });
        const config = store.load();
        expect(config.model).toBe('gpt-4');
        expect(config.port).toBe(3000);
    });

    it('returns empty object when no config', () => {
        expect(store.load()).toEqual({});
    });

    it('overwrites config', () => {
        store.save({ a: 1 });
        store.save({ b: 2 });
        const config = store.load();
        expect(config.b).toBe(2);
        expect(config.a).toBeUndefined();
    });

    it('handles complex nested config', () => {
        const complex = {
            model: 'gpt-4',
            providers: { openai: { key: 'sk-xxx' } },
            features: ['rag', 'tools'],
        };
        store.save(complex);
        expect(store.load()).toEqual(complex);
    });
});

// ═══════════════════════════════════════════════════════════════
// PID FILE
// ═══════════════════════════════════════════════════════════════

import { writePid, readPid, removePid } from '../../src/cli/daemon/pid-file.js';

describe('PID File', () => {
    it('writes and reads PID', () => {
        writePid(12345);
        expect(readPid()).toBe(12345);
    });

    it('returns null when no PID file', () => {
        removePid();
        expect(readPid()).toBeNull();
    });

    it('removes PID file', () => {
        writePid(99999);
        removePid();
        expect(readPid()).toBeNull();
    });

    it('overwrites existing PID', () => {
        writePid(111);
        writePid(222);
        expect(readPid()).toBe(222);
    });
});

// ═══════════════════════════════════════════════════════════════
// DESKTOP NOTIFY (sanitization)
// ═══════════════════════════════════════════════════════════════

// We test the sanitization function indirectly through the module
import { notify } from '../../src/cli/notification/desktop-notify.js';

describe('Desktop Notify', () => {
    it('does not throw on normal input', () => {
        // On non-macOS or CI, osascript will fail silently which is expected
        expect(() => notify('Test Title', 'Test Body')).not.toThrow();
    });

    it('does not throw on malicious input', () => {
        expect(() => notify('"; rm -rf /', '$(whoami)`id`')).not.toThrow();
    });

    it('handles unicode', () => {
        expect(() => notify('🔔 Alert', 'Notification 通知')).not.toThrow();
    });

    it('handles empty strings', () => {
        expect(() => notify('', '')).not.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════
// FILE LOCK
// ═══════════════════════════════════════════════════════════════

import { FileLock } from '../../src/infra/lock/file-lock.js';

describe('FileLock', () => {
    let lockPath: string;
    let lock: FileLock;

    beforeEach(() => {
        lockPath = path.join(os.tmpdir(), `lock-test-${Date.now()}`);
        lock = new FileLock(lockPath);
    });

    afterEach(() => {
        lock.release();
    });

    it('acquires a lock', () => {
        expect(lock.acquire()).toBe(true);
    });

    it('detects existing lock', () => {
        expect(lock.acquire()).toBe(true);
        const lock2 = new FileLock(lockPath);
        expect(lock2.acquire()).toBe(false);
    });

    it('releases lock allows re-acquire', () => {
        lock.acquire();
        lock.release();
        expect(lock.acquire()).toBe(true);
    });

    it('isLocked after acquire', () => {
        lock.acquire();
        expect(lock.isLocked()).toBe(true);
    });

    it('not locked after release', () => {
        lock.acquire();
        lock.release();
        expect(lock.isLocked()).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════
// TASK SCHEDULER
// ═══════════════════════════════════════════════════════════════

import { TaskScheduler } from '../../src/infra/scheduler/task-scheduler.js';

describe('TaskScheduler', () => {
    it('adds a task', () => {
        const scheduler = new TaskScheduler();
        let count = 0;
        scheduler.add('t1', async () => { count++; }, 100);
        expect(count).toBe(0);
    });

    it('starts and stops a task', async () => {
        const scheduler = new TaskScheduler();
        let count = 0;
        scheduler.add('t1', async () => { count++; }, 50);
        scheduler.start('t1');
        await new Promise(r => setTimeout(r, 180));
        scheduler.stop('t1');
        expect(count).toBeGreaterThanOrEqual(2);
    });

    it('double start is safe', () => {
        const scheduler = new TaskScheduler();
        scheduler.add('t1', async () => {}, 100);
        scheduler.start('t1');
        scheduler.start('t1'); // should not double-schedule
        scheduler.stop('t1');
    });

    it('stop without start is safe', () => {
        const scheduler = new TaskScheduler();
        expect(() => scheduler.stop('nonexistent')).not.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════
// ENV FILE
// ═══════════════════════════════════════════════════════════════

import { readEnvFile, writeEnvFile } from '../../src/infra/env-file.js';

describe('readEnvFile / writeEnvFile', () => {
    let tmpFile: string;

    beforeEach(() => {
        tmpFile = path.join(os.tmpdir(), `env-test-${Date.now()}.env`);
    });

    afterEach(() => {
        try { fs.unlinkSync(tmpFile); } catch { /* intentionally ignored */ }
    });

    it('reads key=value pairs', () => {
        fs.writeFileSync(tmpFile, 'KEY1=value1\nKEY2=value2\n');
        const env = readEnvFile(tmpFile);
        expect(env.KEY1).toBe('value1');
        expect(env.KEY2).toBe('value2');
    });

    it('ignores comments and blank lines', () => {
        fs.writeFileSync(tmpFile, '# comment\n\nKEY=val\n');
        const env = readEnvFile(tmpFile);
        expect(Object.keys(env)).toEqual(['KEY']);
    });

    it('strips quotes from values', () => {
        fs.writeFileSync(tmpFile, 'KEY1="quoted"\nKEY2=\'single\'\n');
        const env = readEnvFile(tmpFile);
        expect(env.KEY1).toBe('quoted');
        expect(env.KEY2).toBe('single');
    });

    it('returns empty for missing file', () => {
        expect(readEnvFile('/nonexistent/path/.env')).toEqual({});
    });

    it('writes env file', () => {
        writeEnvFile(tmpFile, { A: '1', B: '2' });
        const content = fs.readFileSync(tmpFile, 'utf-8');
        expect(content).toContain('A=1');
        expect(content).toContain('B=2');
    });

    it('roundtrips env file', () => {
        const original = { DB_HOST: 'localhost', DB_PORT: '5432' };
        writeEnvFile(tmpFile, original);
        const loaded = readEnvFile(tmpFile);
        expect(loaded).toEqual(original);
    });
});

// ═══════════════════════════════════════════════════════════════
// GLOB
// ═══════════════════════════════════════════════════════════════

import { globSync } from '../../src/infra/fs/glob.js';

describe('globSync', () => {
    it('finds files by extension', () => {
        const results = globSync(path.join(__dirname, '../../src/security'), '*.ts');
        expect(results.length).toBeGreaterThan(0);
        expect(results.every(f => f.endsWith('.ts'))).toBe(true);
    });

    it('returns empty for nonexistent dir', () => {
        expect(globSync('/nonexistent/dir', '*.ts')).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════
// CONFIG WATCH
// ═══════════════════════════════════════════════════════════════

import { parseDotenv } from '../../src/config/dotenv.js';

describe('parseDotenv', () => {
    it('parses key=value pairs', () => {
        const env = parseDotenv('KEY=value\nOTHER=test');
        expect(env.KEY).toBe('value');
        expect(env.OTHER).toBe('test');
    });

    it('handles quoted values', () => {
        expect(parseDotenv('K="val"').K).toBe('val');
    });

    it('skips comments', () => {
        const env = parseDotenv('# comment\nKEY=val');
        expect(Object.keys(env)).toEqual(['KEY']);
    });

    it('handles empty content', () => {
        expect(parseDotenv('')).toEqual({});
    });
});
