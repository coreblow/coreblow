import { describe, it, expect } from 'vitest';
import { DockerRuntime, type DockerExecResult } from './docker-runtime.js';

describe('DockerRuntime — construction', () => {
    it('creates with default image and name', () => {
        const runtime = new DockerRuntime();
        expect(runtime.isRunning()).toBe(false);
        expect(runtime.getContainerId()).toBeUndefined();
    });

    it('accepts custom image and name', () => {
        const runtime = new DockerRuntime('ubuntu:22.04', 'my-sandbox');
        expect(runtime.isRunning()).toBe(false);
    });
});

describe('DockerRuntime — isRunning / getContainerId', () => {
    it('reports not running before start', () => {
        const runtime = new DockerRuntime();
        expect(runtime.isRunning()).toBe(false);
        expect(runtime.getContainerId()).toBeUndefined();
    });
});

describe('DockerRuntime — exec without running container', () => {
    it('returns error when container not running', async () => {
        const runtime = new DockerRuntime();
        const result = await runtime.exec('echo hello');
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toContain('not running');
    });
});

describe('DockerRuntime — stop without start', () => {
    it('handles stop gracefully when not running', async () => {
        const runtime = new DockerRuntime();
        // Should not throw
        await expect(runtime.stop()).resolves.toBeUndefined();
        expect(runtime.isRunning()).toBe(false);
    });
});

describe('DockerRuntime.isAvailable', () => {
    it('returns a boolean', async () => {
        const available = await DockerRuntime.isAvailable();
        expect(typeof available).toBe('boolean');
    });
});

describe('DockerExecResult interface', () => {
    it('represents a successful execution', () => {
        const result: DockerExecResult = {
            stdout: 'output',
            stderr: '',
            exitCode: 0,
        };
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('output');
    });

    it('represents a failed execution', () => {
        const result: DockerExecResult = {
            stdout: '',
            stderr: 'command not found',
            exitCode: 127,
        };
        expect(result.exitCode).toBe(127);
        expect(result.stderr).toContain('not found');
    });
});
