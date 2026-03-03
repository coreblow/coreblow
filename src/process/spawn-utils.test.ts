import { describe, it, expect } from 'vitest';
import { resolveCommandStdio, formatSpawnError, collectOutput, spawnWithFallback } from './spawn-utils.js';
import { spawn } from 'node:child_process';

describe('Spawn Utils', () => {
    describe('resolveCommandStdio', () => {
        it('pipe for input', () => {
            const [stdin, stdout, stderr] = resolveCommandStdio({ hasInput: true, preferInherit: false });
            expect(stdin).toBe('pipe');
            expect(stdout).toBe('pipe');
            expect(stderr).toBe('pipe');
        });

        it('inherit when preferred', () => {
            const [stdin] = resolveCommandStdio({ hasInput: false, preferInherit: true });
            expect(stdin).toBe('inherit');
        });

        it('pipe when no input no inherit', () => {
            const [stdin] = resolveCommandStdio({ hasInput: false, preferInherit: false });
            expect(stdin).toBe('pipe');
        });
    });

    describe('formatSpawnError', () => {
        it('formats Error', () => {
            const err = new Error('ENOENT');
            (err as any).code = 'ENOENT';
            (err as any).syscall = 'spawn';
            const msg = formatSpawnError(err);
            expect(msg).toContain('ENOENT');
            expect(msg).toContain('spawn');
        });

        it('formats non-Error', () => {
            expect(formatSpawnError('string error')).toBe('string error');
        });
    });

    describe('collectOutput', () => {
        it('collects stdout', async () => {
            const child = spawn('echo', ['collected']);
            const result = await collectOutput(child);
            expect(result.stdout.trim()).toBe('collected');
            expect(result.exitCode).toBe(0);
        });

        it('collects stderr', async () => {
            const child = spawn('sh', ['-c', 'echo err >&2']);
            const result = await collectOutput(child);
            expect(result.stderr).toContain('err');
        });
    });

    describe('spawnWithFallback', () => {
        it('spawns normally', async () => {
            const result = await spawnWithFallback({ argv: ['echo', 'hi'], options: { stdio: 'pipe' } });
            expect(result.usedFallback).toBe(false);
            expect(result.child.pid).toBeGreaterThan(0);
            result.child.kill();
        });
    });
});
