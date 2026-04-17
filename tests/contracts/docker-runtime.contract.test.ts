/**
 * Contract Test: DockerRuntime
 *
 * Verifikasi behavioral contract dari DockerRuntime public API.
 *
 * Contracts:
 * 1. isAvailable() selalu return boolean (never throws)
 * 2. Constructor menerima optional image + name
 * 3. isRunning() selalu return boolean
 * 4. getContainerId() return string | undefined
 * 5. exec() saat not running selalu return { exitCode: 1, stderr: non-empty }
 * 6. start() idempotent — double call tidak crash
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DockerRuntime } from '../../src/sandbox/docker-runtime.js';

vi.mock('node:child_process', () => ({
    execFile: vi.fn((_bin, _args, _opts, cb) => {
        (cb as Function)(new Error('docker not available in test env'), '', '');
        return {} as any;
    }),
}));

describe('DockerRuntime — static contract', () => {
    it('isAvailable() always returns boolean (never throws)', async () => {
        const result = await DockerRuntime.isAvailable();
        expect(typeof result).toBe('boolean');
    });
});

describe('DockerRuntime — instance shape contract', () => {
    let runtime: DockerRuntime;

    beforeEach(() => {
        vi.clearAllMocks();
        runtime = new DockerRuntime();
    });

    it('isRunning() returns false before start()', () => {
        expect(runtime.isRunning()).toBe(false);
    });

    it('getContainerId() returns undefined before start()', () => {
        expect(runtime.getContainerId()).toBeUndefined();
    });

    it('exec() when not running returns { exitCode: 1, stderr: non-empty }', async () => {
        const result = await runtime.exec('ls');
        expect(result.exitCode).toBe(1);
        expect(typeof result.stderr).toBe('string');
        expect(result.stderr.length).toBeGreaterThan(0);
    });

    it('exec() always returns { stdout, stderr, exitCode }', async () => {
        const result = await runtime.exec('echo hi');
        expect('stdout' in result).toBe(true);
        expect('stderr' in result).toBe(true);
        expect('exitCode' in result).toBe(true);
        expect(typeof result.stdout).toBe('string');
        expect(typeof result.stderr).toBe('string');
        expect(typeof result.exitCode).toBe('number');
    });

    it('stop() when not running does not throw', async () => {
        await expect(runtime.stop()).resolves.toBeUndefined();
    });

    it('start() failure does not leave runtime in running state', async () => {
        const result = await runtime.start(); // docker not available in test
        expect(result).toBe(false);
        expect(runtime.isRunning()).toBe(false);
    });
});
