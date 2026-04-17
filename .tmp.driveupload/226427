/**
 * Unit Test: DockerRuntime
 *
 * Tests untuk DockerRuntime — mock execFile agar tidak butuh
 * Docker daemon yang sesungguhnya.
 *
 * @see gateway/src/sandbox/docker-runtime.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DockerRuntime } from '../../src/sandbox/docker-runtime.js';

// ─── Mock execFile ─────────────────────────────────────────────────────────────

vi.mock('node:child_process', () => ({
    execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';
const mockExecFile = vi.mocked(execFile);

function mockDockerSuccess(stdout: string = '') {
    mockExecFile.mockImplementation((_bin, _args, _opts, cb) => {
        (cb as Function)(null, stdout, '');
        return {} as any;
    });
}

function mockDockerFailure(stderr: string = 'docker: command not found') {
    mockExecFile.mockImplementation((_bin, _args, _opts, cb) => {
        const err = new Error(stderr);
        (cb as Function)(err, '', stderr);
        return {} as any;
    });
}

// ─── isAvailable ──────────────────────────────────────────────────────────────

describe('DockerRuntime.isAvailable()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns true when docker --version succeeds', async () => {
        mockDockerSuccess('Docker version 26.0.0');
        const available = await DockerRuntime.isAvailable();
        expect(available).toBe(true);
        expect(mockExecFile).toHaveBeenCalledWith(
            'docker', ['--version'],
            expect.objectContaining({ timeout: 5_000 }),
            expect.any(Function),
        );
    });

    it('returns false when docker binary not found', async () => {
        mockDockerFailure('docker: command not found');
        const available = await DockerRuntime.isAvailable();
        expect(available).toBe(false);
    });

    it('always returns boolean (never throws)', async () => {
        mockDockerFailure();
        const result = await DockerRuntime.isAvailable();
        expect(typeof result).toBe('boolean');
    });
});

// ─── Constructor ──────────────────────────────────────────────────────────────

describe('DockerRuntime constructor', () => {
    it('uses node:24-alpine default image (not node:20)', () => {
        const runtime = new DockerRuntime();
        // Access private via any for test
        expect((runtime as any).image).toBe('node:24-alpine');
    });

    it('uses coreblow-sandbox default name', () => {
        const runtime = new DockerRuntime();
        expect((runtime as any).name).toBe('coreblow-sandbox');
    });

    it('accepts custom image and name', () => {
        const runtime = new DockerRuntime('python:3.12-alpine', 'py-sandbox');
        expect((runtime as any).image).toBe('python:3.12-alpine');
        expect((runtime as any).name).toBe('py-sandbox');
    });
});

// ─── start() ─────────────────────────────────────────────────────────────────

describe('DockerRuntime.start()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns true and sets running when docker run succeeds', async () => {
        mockDockerSuccess('abc123-container-id\n');
        const runtime = new DockerRuntime();
        const result = await runtime.start();
        expect(result).toBe(true);
        expect(runtime.isRunning()).toBe(true);
        expect(runtime.getContainerId()).toBe('abc123-container-id');
    });

    it('returns false when docker run fails', async () => {
        mockDockerFailure('No such image');
        const runtime = new DockerRuntime();
        const result = await runtime.start();
        expect(result).toBe(false);
        expect(runtime.isRunning()).toBe(false);
    });

    it('is idempotent — second call returns true without re-running docker', async () => {
        mockDockerSuccess('container-xyz\n');
        const runtime = new DockerRuntime();
        await runtime.start();
        vi.clearAllMocks();
        mockDockerFailure(); // would fail if called again

        const result = await runtime.start();
        expect(result).toBe(true);
        expect(mockExecFile).not.toHaveBeenCalled(); // no second docker run
    });

    it('passes security flags: --network=none, --memory=256m, --cpus=0.5, --read-only', async () => {
        mockDockerSuccess('cid\n');
        const runtime = new DockerRuntime();
        await runtime.start();

        const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
        expect(callArgs).toContain('--network=none');
        expect(callArgs).toContain('--memory=256m');
        expect(callArgs).toContain('--cpus=0.5');
        expect(callArgs).toContain('--read-only');
    });

    it('passes --tmpfs=/tmp for writable temp space', async () => {
        mockDockerSuccess('cid\n');
        const runtime = new DockerRuntime();
        await runtime.start();

        const callArgs = mockExecFile.mock.calls[0]?.[1] as string[];
        const tmpfsFlag = callArgs.find(a => a.startsWith('--tmpfs'));
        expect(tmpfsFlag).toContain('/tmp');
    });
});

// ─── stop() ──────────────────────────────────────────────────────────────────

describe('DockerRuntime.stop()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('calls docker stop with containerId', async () => {
        mockDockerSuccess('stop-test-cid\n');
        const runtime = new DockerRuntime();
        await runtime.start();

        vi.clearAllMocks();
        mockDockerSuccess();
        await runtime.stop();

        expect(mockExecFile).toHaveBeenCalledWith(
            'docker',
            ['stop', 'stop-test-cid'],
            expect.any(Object),
            expect.any(Function),
        );
        expect(runtime.isRunning()).toBe(false);
        expect(runtime.getContainerId()).toBeUndefined();
    });

    it('noop when not running', async () => {
        const runtime = new DockerRuntime();
        await runtime.stop(); // should not throw
        expect(mockExecFile).not.toHaveBeenCalled();
    });
});

// ─── exec() ──────────────────────────────────────────────────────────────────

describe('DockerRuntime.exec()', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns error when container not running', async () => {
        const runtime = new DockerRuntime();
        const result = await runtime.exec('ls /');
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('not running');
    });

    it('calls docker exec with containerId and /bin/sh -c', async () => {
        // Start first
        mockDockerSuccess('exec-test-cid\n');
        const runtime = new DockerRuntime();
        await runtime.start();

        vi.clearAllMocks();
        mockDockerSuccess('file1\nfile2\n');
        const result = await runtime.exec('ls /tmp');

        expect(mockExecFile).toHaveBeenCalledWith(
            'docker',
            ['exec', 'exec-test-cid', '/bin/sh', '-c', 'ls /tmp'],
            expect.any(Object),
            expect.any(Function),
        );
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('file1');
    });
});
