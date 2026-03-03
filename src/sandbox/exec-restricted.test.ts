import { describe, it, expect } from 'vitest';
import { buildSanitizedEnv, execRestricted } from './exec-restricted.js';
import type { ExecResult } from './sandbox-types.js';
import { DockerRuntime } from './docker-runtime.js';

// ─── buildSanitizedEnv ──────────────────────────────────────────

describe('buildSanitizedEnv', () => {
    it('returns an object (not undefined)', () => {
        const env = buildSanitizedEnv();
        expect(env).toBeDefined();
        expect(typeof env).toBe('object');
    });

    it('strips known secret keys', () => {
        const origKeys = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GITHUB_TOKEN', 'DISCORD_TOKEN'];
        // Set them temporarily
        for (const key of origKeys) process.env[key] = 'test-secret';
        const env = buildSanitizedEnv();
        for (const key of origKeys) {
            expect(env[key]).toBeUndefined();
        }
        // Cleanup
        for (const key of origKeys) delete process.env[key];
    });

    it('strips pattern-matched secret keys', () => {
        process.env['MY_APP_SECRET'] = 'secret';
        process.env['DB_PASSWORD'] = 'pass';
        process.env['CUSTOM_API_KEY'] = 'key';
        process.env['SSH_PRIVATE_KEY'] = 'pk';
        const env = buildSanitizedEnv();
        expect(env['MY_APP_SECRET']).toBeUndefined();
        expect(env['DB_PASSWORD']).toBeUndefined();
        expect(env['CUSTOM_API_KEY']).toBeUndefined();
        expect(env['SSH_PRIVATE_KEY']).toBeUndefined();
        // Cleanup
        delete process.env['MY_APP_SECRET'];
        delete process.env['DB_PASSWORD'];
        delete process.env['CUSTOM_API_KEY'];
        delete process.env['SSH_PRIVATE_KEY'];
    });

    it('preserves non-secret env vars', () => {
        process.env['SAFE_VAR'] = 'hello';
        const env = buildSanitizedEnv();
        expect(env['SAFE_VAR']).toBe('hello');
        delete process.env['SAFE_VAR'];
    });

    it('forces TERM=dumb', () => {
        const env = buildSanitizedEnv();
        expect(env['TERM']).toBe('dumb');
    });

    it('removes HISTFILE and SAVEHIST', () => {
        process.env['HISTFILE'] = '/home/.bash_history';
        process.env['SAVEHIST'] = '1000';
        const env = buildSanitizedEnv();
        expect(env['HISTFILE']).toBeUndefined();
        expect(env['SAVEHIST']).toBeUndefined();
        delete process.env['HISTFILE'];
        delete process.env['SAVEHIST'];
    });
});

// ─── execRestricted — input validation ──────────────────────────

describe('execRestricted — input validation', () => {
    it('rejects empty command', async () => {
        const result = await execRestricted('');
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('Invalid command');
        expect(result.mode).toBe('restricted-native');
    });

    it('rejects null byte in command', async () => {
        const result = await execRestricted('echo\0hello');
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('null bytes');
    });

    it('rejects command exceeding max length', async () => {
        const longCmd = 'x'.repeat(40_000);
        const result = await execRestricted(longCmd);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('max length');
    });
});

// ─── execRestricted — execution ─────────────────────────────────

describe('execRestricted — execution', () => {
    it('executes a simple command', async () => {
        const result = await execRestricted('echo hello');
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe('hello');
        expect(result.mode).toBe('restricted-native');
    });

    it('captures stderr', async () => {
        const result = await execRestricted('echo error >&2');
        expect(result.stderr.trim()).toBe('error');
    });

    it('returns non-zero exit code for failing command', async () => {
        const result = await execRestricted('exit 42');
        expect(result.exitCode).not.toBe(0);
    });

    it('handles timeout', async () => {
        const result = await execRestricted('sleep 10', { timeout: 200 });
        expect(result.timedOut).toBe(true);
    });
});

// ─── DockerRuntime — unit tests (no Docker required) ────────────

describe('DockerRuntime', () => {
    it('starts in non-running state', () => {
        const rt = new DockerRuntime();
        expect(rt.isRunning()).toBe(false);
        expect(rt.getContainerId()).toBeUndefined();
    });

    it('exec returns error when not running', async () => {
        const rt = new DockerRuntime();
        const result = await rt.exec('echo hello');
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('not running');
    });

    it('stop is safe when not running', async () => {
        const rt = new DockerRuntime();
        await rt.stop(); // should not throw
        expect(rt.isRunning()).toBe(false);
    });

    it('isAvailable returns boolean', async () => {
        const result = await DockerRuntime.isAvailable();
        expect(typeof result).toBe('boolean');
    });
});

// ─── sandbox-types — type guard ─────────────────────────────────

describe('sandbox-types', () => {
    it('ExecResult structure is correct', () => {
        const result: ExecResult = {
            stdout: 'out', stderr: '', exitCode: 0,
            timedOut: false, truncated: false, mode: 'restricted-native',
        };
        expect(result.mode).toBe('restricted-native');
        expect(result.timedOut).toBe(false);
    });

    it('ExecResult accepts all mode variants', () => {
        const modes: ExecResult['mode'][] = ['docker', 'restricted-native', 'host'];
        for (const mode of modes) {
            const r: ExecResult = { stdout: '', stderr: '', exitCode: 0, timedOut: false, truncated: false, mode };
            expect(r.mode).toBe(mode);
        }
    });
});
