/**
 * Bash Tools Exec — Core command execution via child_process.
 *
 * Replaces the stub with a real child_process.execFile implementation.
 * Includes timeout, working directory, environment, and output capture.
 */
import { execFile } from 'node:child_process';

export interface BashExecResult { stdout: string; stderr: string; exitCode: number; duration: number; }

export interface BashExecOptions {
    timeout?: number;
    cwd?: string;
    env?: Record<string, string>;
    maxBuffer?: number;
    shell?: boolean;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024; // 10MB

export async function bashToolsExec(cmd: string, opts: BashExecOptions = {}): Promise<BashExecResult> {
    const start = Date.now();
    const timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    const maxBuffer = opts.maxBuffer ?? DEFAULT_MAX_BUFFER;
    const env = opts.env ? { ...process.env, ...opts.env } : process.env;

    return new Promise<BashExecResult>((resolve) => {
        const child = execFile(
            '/bin/sh',
            ['-c', cmd],
            { timeout, maxBuffer, cwd: opts.cwd, env, shell: false },
            (error, stdout, stderr) => {
                const duration = Date.now() - start;
                if (error) {
                    const exitCode = typeof error.code === 'number' ? error.code : (error as NodeJS.ErrnoException).errno ?? 1;
                    resolve({ stdout: stdout ?? '', stderr: stderr || error.message, exitCode, duration });
                } else {
                    resolve({ stdout: stdout ?? '', stderr: stderr ?? '', exitCode: 0, duration });
                }
            },
        );

        // Safety: ensure the child is killed on timeout
        child.on('error', (err) => {
            resolve({ stdout: '', stderr: err.message, exitCode: 1, duration: Date.now() - start });
        });
    });
}
