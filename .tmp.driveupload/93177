/**
 * process/exec.ts
 * Safe command execution with timeout and output capture.
 * Ported from OpenClaw src/process/exec.ts.
 */

import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    killed: boolean;
    durationMs: number;
}

export interface ExecOptions {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    maxBuffer?: number;
    shell?: boolean;
    stdin?: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024; // 10MB

/**
 * Execute a command and capture output.
 */
export async function exec(command: string, args: string[] = [], opts?: ExecOptions): Promise<ExecResult> {
    const start = Date.now();
    const timeout = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBuffer = opts?.maxBuffer ?? DEFAULT_MAX_BUFFER;

    try {
        const result = await execFileAsync(command, args, {
            cwd: opts?.cwd,
            env: opts?.env ?? process.env,
            timeout,
            maxBuffer,
            shell: opts?.shell,
        });

        return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: 0,
            killed: false,
            durationMs: Date.now() - start,
        };
    } catch (err) {
        const error = err as { stdout?: string; stderr?: string; code?: number; killed?: boolean; signal?: string };
        return {
            stdout: error.stdout ?? '',
            stderr: error.stderr ?? '',
            exitCode: error.code ?? 1,
            killed: error.killed ?? error.signal === 'SIGTERM',
            durationMs: Date.now() - start,
        };
    }
}

/**
 * Execute a shell command string.
 */
export async function execShell(command: string, opts?: ExecOptions): Promise<ExecResult> {
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const args = process.platform === 'win32' ? ['/c', command] : ['-c', command];
    return exec(shell, args, { ...opts, shell: false });
}

/**
 * Check if a command exists.
 */
export async function commandExists(command: string): Promise<boolean> {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const result = await exec(which, [command], { timeoutMs: 5000 });
    return result.exitCode === 0;
}
