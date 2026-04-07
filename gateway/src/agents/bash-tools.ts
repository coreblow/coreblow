/**
 * agents/bash-tools.ts
 * Bash/exec tool definitions and execution logic.
 */
import { splitShellCommand, isUnsafeCommand, buildShellExec } from './shell-utils.js';
import { type ProcessSession, addSession, createSessionSlug, markBackgrounded, appendOutput, markExited } from './bash-process-registry.js';
import { spawn } from 'node:child_process';

export interface ExecOptions { command: string; cwd?: string; env?: Record<string, string>; timeout?: number; maxOutputChars?: number; background?: boolean; stdin?: string; }
export interface ExecResult { exitCode: number | null; stdout: string; stderr: string; duration: number; truncated: boolean; sessionId?: string; }

export async function execCommand(opts: ExecOptions): Promise<ExecResult> {
    const safety = isUnsafeCommand(opts.command);
    if (safety.unsafe) return { exitCode: 1, stdout: '', stderr: `Blocked: ${safety.reason}`, duration: 0, truncated: false };
    const { cmd, args } = buildShellExec(opts.command);
    const maxOutput = opts.maxOutputChars ?? 200_000;
    const timeout = opts.timeout ?? 30_000;
    const startMs = Date.now();

    return new Promise<ExecResult>((resolve) => {
        const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ? { ...process.env, ...opts.env } : undefined, stdio: ['pipe', 'pipe', 'pipe'] });
        const session: ProcessSession = {
            id: createSessionSlug(), command: opts.command, startedAt: startMs, cwd: opts.cwd,
            maxOutputChars: maxOutput, totalOutputChars: 0, pendingStdout: [], pendingStderr: [],
            pendingStdoutChars: 0, pendingStderrChars: 0, aggregated: '', tail: '',
            exited: false, truncated: false, backgrounded: !!opts.background, pid: child.pid,
        };

        if (opts.background) { addSession(session); markBackgrounded(session); }

        let stdout = '', stderr = '';
        child.stdout?.on('data', (chunk: Buffer) => { const s = chunk.toString(); stdout += s; if (opts.background) appendOutput(session, 'stdout', s); });
        child.stderr?.on('data', (chunk: Buffer) => { const s = chunk.toString(); stderr += s; if (opts.background) appendOutput(session, 'stderr', s); });

        if (opts.stdin) { child.stdin?.write(opts.stdin); child.stdin?.end(); }

        const timer = setTimeout(() => { child.kill('SIGTERM'); }, timeout);

        child.on('close', (code, signal) => {
            clearTimeout(timer);
            if (opts.background) markExited(session, code, signal, code === 0 ? 'completed' : 'failed');
            const truncated = stdout.length > maxOutput || stderr.length > maxOutput;
            resolve({ exitCode: code, stdout: stdout.slice(-maxOutput), stderr: stderr.slice(-maxOutput), duration: Date.now() - startMs, truncated, sessionId: opts.background ? session.id : undefined });
        });
        child.on('error', (err) => { clearTimeout(timer); resolve({ exitCode: 1, stdout: '', stderr: err.message, duration: Date.now() - startMs, truncated: false }); });
    });
}

export function buildExecToolSchema(): Record<string, unknown> {
    return {
        name: 'bash', description: 'Execute a shell command',
        input_schema: { type: 'object', properties: { command: { type: 'string', description: 'The command to execute' }, timeout: { type: 'number', description: 'Timeout in ms' } }, required: ['command'] },
    };
}
