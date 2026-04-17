/**
 * Docker Runtime — Manages Docker container lifecycle for sandboxed execution.
 *
 * Provides start/stop container management and command execution
 * inside isolated Docker containers.
 */
import { execFile } from 'node:child_process';

export interface DockerExecResult { stdout: string; stderr: string; exitCode: number; }

export class DockerRuntime {
    private running = false;
    private containerId?: string;
    private image: string;
    private name: string;

    constructor(image: string = 'node:20-alpine', name: string = 'coreblow-sandbox') {
        this.image = image;
        this.name = name;
    }

    async start(): Promise<boolean> {
        if (this.running) return true;
        try {
            const result = await this.run('docker', ['run', '-d', '--name', this.name, '--rm', '--network=none',
                '--memory=256m', '--cpus=0.5', this.image, 'sleep', '3600']);
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
