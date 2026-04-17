/**
 * Docker Runtime — Manages Docker container lifecycle for sandboxed execution.
 *
 * Provides start/stop container management and command execution
 * inside isolated Docker containers.
 *
 * Kebutuhan Docker CLI:
 *   - Default: `docker` binary harus tersedia di PATH
 *   - Di kontainer: build dengan: docker build --build-arg COREBLOW_INSTALL_DOCKER_CLI=1 .
 *   - Pola OC: DockerRuntime.isAvailable() sebelum instantiate
 *
 * Keamanan:
 *   - Container berjalan dengan --network=none (no network access)
 *   - Memory limit: 256m, CPU limit: 0.5 core
 *   - Tidak ada daemon — hanya CLI yang diperlukan
 *
 * @see coreblow/Dockerfile L202-L232 (OPENCLAW_INSTALL_DOCKER_CLI)
 */
import { execFile } from 'node:child_process';

export interface DockerExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export class DockerRuntime {
    private running = false;
    private containerId?: string;
    private image: string;
    private name: string;

    constructor(image: string = 'node:24-alpine', name: string = 'coreblow-sandbox') {
        this.image = image;
        this.name = name;
    }

    /**
     * Check apakah Docker CLI tersedia di PATH.
     * Pola defensif — panggil sebelum instantiate DockerRuntime.
     *
     * @example
     * if (await DockerRuntime.isAvailable()) {
     *   const runtime = new DockerRuntime();
     *   await runtime.start();
     * }
     */
    static isAvailable(): Promise<boolean> {
        return new Promise((resolve) => {
            execFile('docker', ['--version'], { timeout: 5_000 }, (err) => {
                resolve(!err);
            });
        });
    }

    async start(): Promise<boolean> {
        if (this.running) return true;
        try {
            const result = await this.run('docker', [
                'run', '-d',
                '--name', this.name,
                '--rm',
                '--network=none',
                '--memory=256m',
                '--cpus=0.5',
                // Read-only root filesystem (pola hardening)
                '--read-only',
                // Tmpfs untuk process yang butuh tulis temp
                '--tmpfs=/tmp:size=64m,noexec',
                this.image,
                'sleep', '3600',
            ]);
            if (result.exitCode !== 0) { return false; }
            this.containerId = result.stdout.trim();
            this.running = true;
            return true;
        } catch {
            return false;
        }
    }

    async stop(): Promise<void> {
        if (!this.running || !this.containerId) return;
        await this.run('docker', ['stop', this.containerId]).catch(() => {});
        this.running = false;
        this.containerId = undefined;
    }

    isRunning(): boolean { return this.running; }

    async exec(cmd: string, timeout: number = 30_000): Promise<DockerExecResult> {
        if (!this.running || !this.containerId) {
            return { stdout: '', stderr: 'Container not running', exitCode: 1 };
        }
        return this.run('docker', ['exec', this.containerId, '/bin/sh', '-c', cmd], timeout);
    }

    getContainerId(): string | undefined { return this.containerId; }

    private run(bin: string, args: string[], timeout: number = 30_000): Promise<DockerExecResult> {
        return new Promise((resolve) => {
            execFile(bin, args, { timeout, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
                if (error) {
                    resolve({ stdout: stdout ?? '', stderr: stderr || error.message, exitCode: 1 });
                } else {
                    resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0 });
                }
            });
        });
    }
}
