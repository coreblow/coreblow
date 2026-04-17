/**
 * CoreBlow Bash Tools Exec Pipeline
 *
 * Core execution engine for bash/shell commands. Handles command parsing,
 * sandboxing, output capture, timeout management, and approval workflows.
 *
 * Consolidates: CoreBlow bash-tools.exec.ts (648), bash-tools.exec-runtime.ts (735),
 *               bash-tools.process.ts (665) = 2,048 LOC total into CoreBlow OOP pattern.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('bash-tools');

// ─── Types ────────────────────────────────────────────────────────

export type ExecStatus = 'pending' | 'running' | 'complete' | 'timeout' | 'killed' | 'error' | 'approval-pending';

export interface ExecRequest {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    timeoutMs?: number;
    background?: boolean;
    yieldMs?: number;
    shell?: string;
    requireApproval?: boolean;
    sessionId?: string;
    labels?: string[];
}

export interface ExecResult {
    id: string;
    command: string;
    status: ExecStatus;
    exitCode: number | null;
    stdout: string;
    stderr: string;
    durationMs: number;
    startedAt: number;
    completedAt?: number;
    truncated: boolean;
    pid?: number;
}

export interface BackgroundProcess {
    id: string;
    command: string;
    pid: number;
    status: ExecStatus;
    startedAt: number;
    stdout: string[];
    stderr: string[];
    process: ChildProcess;
    exitCode: number | null;
    labels: string[];
}

export interface ProcessPollResult {
    id: string;
    status: ExecStatus;
    exitCode: number | null;
    newStdout: string;
    newStderr: string;
    totalStdoutLines: number;
    totalStderrLines: number;
    durationMs: number;
}

export interface ApprovalRequest {
    id: string;
    command: string;
    sessionId: string;
    requestedAt: number;
    status: 'pending' | 'approved' | 'denied';
    reason?: string;
}

// ─── Constants ────────────────────────────────────────────────────

const MAX_OUTPUT_BYTES = 100_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_SHELL = process.env['SHELL'] ?? '/bin/bash';

// ─── Dangerous Command Detection ─────────────────────────────────

const DANGEROUS_PATTERNS = [
    /\brm\s+(-[a-z]*f|-[a-z]*r|--force|--recursive)\b/i,
    /\brm\s+-[a-z]*rf\b/i,
    /\bmkfs\b/i,
    /\bdd\s+if=/i,
    /\b(chmod|chown)\s+(-R\s+)?[0-7]{3,4}\s+\//i,
    /\bsudo\s+rm\b/i,
    />\s*\/dev\/sd[a-z]/i,
    /\bcurl\b.*\|\s*(bash|sh)\b/i,
    /\bwget\b.*\|\s*(bash|sh)\b/i,
    /\bkill\s+-9\s+1\b/,
    /\bshutdown\b/i,
    /\breboot\b/i,
    /\binit\s+0\b/,
];

/**
 * Check if a command is potentially dangerous
 */
export function isDangerousCommand(command: string): { dangerous: boolean; reason?: string } {
    const trimmed = command.trim();
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(trimmed)) {
            return { dangerous: true, reason: `Matches dangerous pattern: ${pattern.source}` };
        }
    }
    return { dangerous: false };
}

// ─── Command Sanitization ─────────────────────────────────────────

/**
 * Sanitize console output (strip ANSI escape codes)
 */
export function sanitizeOutput(output: string): string {
    // Strip ANSI escape codes
    return output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Truncate output to max bytes
 */
export function truncateExecOutput(
    output: string,
    maxBytes: number = MAX_OUTPUT_BYTES,
): { text: string; truncated: boolean } {
    if (Buffer.byteLength(output) <= maxBytes) {
        return { text: output, truncated: false };
    }

    // Take from the end (most relevant output)
    const lines = output.split('\n');
    let result = '';
    let byteCount = 0;

    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i]! + '\n';
        const lineBytes = Buffer.byteLength(line);
        if (byteCount + lineBytes > maxBytes) break;
        result = line + result;
        byteCount += lineBytes;
    }

    const omitted = output.split('\n').length - result.split('\n').length;
    return {
        text: `[... ${omitted} lines omitted ...]\n${result}`,
        truncated: true,
    };
}

// ─── Exec Engine ──────────────────────────────────────────────────

let execCounter = 0;
const backgroundProcesses = new Map<string, BackgroundProcess>();
const approvalRequests = new Map<string, ApprovalRequest>();

function generateExecId(): string {
    return `exec_${Date.now()}_${++execCounter}`;
}

/**
 * Execute a command synchronously (with timeout)
 */
export async function execCommand(request: ExecRequest): Promise<ExecResult> {
    const id = generateExecId();
    const command = request.command.trim();
    const cwd = request.cwd ?? process.cwd();
    const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const shell = request.shell ?? DEFAULT_SHELL;

    // Check for dangerous commands
    if (request.requireApproval !== false) {
        const check = isDangerousCommand(command);
        if (check.dangerous) {
            const approvalId = `approval_${id}`;
            approvalRequests.set(approvalId, {
                id: approvalId,
                command,
                sessionId: request.sessionId ?? 'unknown',
                requestedAt: Date.now(),
                status: 'pending',
                reason: check.reason,
            });
            return {
                id,
                command,
                status: 'approval-pending',
                exitCode: null,
                stdout: '',
                stderr: `Command requires approval: ${check.reason}\nUse /approve ${approvalId} allow-once to proceed.`,
                durationMs: 0,
                startedAt: Date.now(),
                truncated: false,
            };
        }
    }

    const startedAt = Date.now();

    // Background mode
    if (request.background) {
        return execBackground(id, command, cwd, shell, request);
    }

    // Foreground execution
    return new Promise<ExecResult>((resolve) => {
        let stdout = '';
        let stderr = '';
        let resolved = false;

        const proc = spawn(shell, ['-c', command], {
            cwd,
            env: { ...process.env, ...request.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        const timer = setTimeout(() => {
            if (!resolved) {
                resolved = true;
                proc.kill('SIGKILL');
                resolve({
                    id,
                    command,
                    status: 'timeout',
                    exitCode: null,
                    stdout: sanitizeOutput(stdout),
                    stderr: sanitizeOutput(stderr),
                    durationMs: Date.now() - startedAt,
                    startedAt,
                    truncated: false,
                    pid: proc.pid,
                });
            }
        }, timeoutMs);

        proc.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString();
        });

        proc.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString();
        });

        // Yield mode: return after yieldMs even if not done
        if (request.yieldMs && request.yieldMs > 0) {
            setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timer);
                    // Move to background
                    const bgId = id;
                    backgroundProcesses.set(bgId, {
                        id: bgId,
                        command,
                        pid: proc.pid ?? 0,
                        status: 'running',
                        startedAt,
                        stdout: [stdout],
                        stderr: [stderr],
                        process: proc,
                        exitCode: null,
                        labels: request.labels ?? [],
                    });

                    proc.on('exit', (code) => {
                        const bg = backgroundProcesses.get(bgId);
                        if (bg) {
                            bg.status = 'complete';
                            bg.exitCode = code;
                        }
                    });

                    resolve({
                        id: bgId,
                        command,
                        status: 'running',
                        exitCode: null,
                        stdout: sanitizeOutput(stdout),
                        stderr: sanitizeOutput(stderr),
                        durationMs: Date.now() - startedAt,
                        startedAt,
                        truncated: false,
                        pid: proc.pid,
                    });
                }
            }, request.yieldMs);
        }

        proc.on('exit', (code) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                const { text: truncStdout, truncated: stdoutTruncated } = truncateExecOutput(sanitizeOutput(stdout));
                const { text: truncStderr } = truncateExecOutput(sanitizeOutput(stderr));
                resolve({
                    id,
                    command,
                    status: code === 0 ? 'complete' : 'error',
                    exitCode: code,
                    stdout: truncStdout,
                    stderr: truncStderr,
                    durationMs: Date.now() - startedAt,
                    startedAt,
                    completedAt: Date.now(),
                    truncated: stdoutTruncated,
                    pid: proc.pid,
                });
            }
        });

        proc.on('error', (err) => {
            if (!resolved) {
                resolved = true;
                clearTimeout(timer);
                resolve({
                    id,
                    command,
                    status: 'error',
                    exitCode: null,
                    stdout: sanitizeOutput(stdout),
                    stderr: err.message,
                    durationMs: Date.now() - startedAt,
                    startedAt,
                    truncated: false,
                });
            }
        });
    });
}

// ─── Background Process Management ────────────────────────────────

function execBackground(
    id: string,
    command: string,
    cwd: string,
    shell: string,
    request: ExecRequest,
): ExecResult {
    const startedAt = Date.now();
    const proc = spawn(shell, ['-c', command], {
        cwd,
        env: { ...process.env, ...request.env },
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false,
    });

    const bg: BackgroundProcess = {
        id,
        command,
        pid: proc.pid ?? 0,
        status: 'running',
        startedAt,
        stdout: [],
        stderr: [],
        process: proc,
        exitCode: null,
        labels: request.labels ?? [],
    };

    proc.stdout?.on('data', (data: Buffer) => {
        bg.stdout.push(data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
        bg.stderr.push(data.toString());
    });

    proc.on('exit', (code) => {
        bg.status = 'complete';
        bg.exitCode = code;
    });

    proc.on('error', (err) => {
        bg.status = 'error';
        bg.stderr.push(err.message);
    });

    backgroundProcesses.set(id, bg);

    return {
        id,
        command,
        status: 'running',
        exitCode: null,
        stdout: `Background process started (PID: ${proc.pid})`,
        stderr: '',
        durationMs: 0,
        startedAt,
        truncated: false,
        pid: proc.pid,
    };
}

/**
 * Poll a background process for output
 */
export function pollProcess(id: string, timeoutMs?: number): ProcessPollResult | null {
    const bg = backgroundProcesses.get(id);
    if (!bg) return null;

    const newStdout = bg.stdout.splice(0).join('');
    const newStderr = bg.stderr.splice(0).join('');

    return {
        id,
        status: bg.status,
        exitCode: bg.exitCode,
        newStdout: sanitizeOutput(newStdout),
        newStderr: sanitizeOutput(newStderr),
        totalStdoutLines: newStdout.split('\n').length,
        totalStderrLines: newStderr.split('\n').length,
        durationMs: Date.now() - bg.startedAt,
    };
}

/**
 * Kill a background process
 */
export function killProcess(id: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const bg = backgroundProcesses.get(id);
    if (!bg || bg.status !== 'running') return false;

    try {
        bg.process.kill(signal);
        bg.status = 'killed';
        log.info({ id, pid: bg.pid, signal }, 'Process killed');
        return true;
    } catch {
        return false;
    }
}

/**
 * List all background processes
 */
export function listBackgroundProcesses(filter?: {
    status?: ExecStatus;
    sessionId?: string;
}): Array<{
    id: string;
    command: string;
    pid: number;
    status: ExecStatus;
    startedAt: number;
    durationMs: number;
    labels: string[];
}> {
    const result: Array<{
        id: string;
        command: string;
        pid: number;
        status: ExecStatus;
        startedAt: number;
        durationMs: number;
        labels: string[];
    }> = [];

    for (const bg of backgroundProcesses.values()) {
        if (filter?.status && bg.status !== filter.status) continue;
        result.push({
            id: bg.id,
            command: bg.command.slice(0, 100),
            pid: bg.pid,
            status: bg.status,
            startedAt: bg.startedAt,
            durationMs: Date.now() - bg.startedAt,
            labels: bg.labels,
        });
    }

    return result;
}

/**
 * Clean up completed background processes
 */
export function cleanupCompleted(maxAge: number = 300_000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, bg] of backgroundProcesses) {
        if (bg.status === 'complete' || bg.status === 'error' || bg.status === 'killed') {
            if (now - bg.startedAt > maxAge) {
                backgroundProcesses.delete(id);
                cleaned++;
            }
        }
    }

    return cleaned;
}

// ─── Approval Management ──────────────────────────────────────────

/**
 * Approve or deny a pending command
 */
export function resolveApproval(approvalId: string, action: 'allow-once' | 'allow-always' | 'deny'): boolean {
    const request = approvalRequests.get(approvalId);
    if (!request || request.status !== 'pending') return false;

    request.status = action === 'deny' ? 'denied' : 'approved';
    log.info({ approvalId, action, command: request.command }, 'Approval resolved');
    return true;
}

/**
 * Get pending approvals
 */
export function getPendingApprovals(): ApprovalRequest[] {
    return Array.from(approvalRequests.values()).filter((r) => r.status === 'pending');
}

/**
 * Clear completed approvals
 */
export function clearCompletedApprovals(): void {
    for (const [id, request] of approvalRequests) {
        if (request.status !== 'pending') {
            approvalRequests.delete(id);
        }
    }
}
