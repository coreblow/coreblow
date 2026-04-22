import { clamp } from "../utils.js";
/**
 * agents/bash-process-registry.ts
 * Background process session registry for exec/process tools.
 * Ported from CoreBlow reference src/agents/bash-process-registry.ts (312 LOC).
 */

const DEFAULT_JOB_TTL_MS = 30 * 60 * 1000;
const MIN_JOB_TTL_MS = 60 * 1000;
const MAX_JOB_TTL_MS = 3 * 60 * 60 * 1000;
const DEFAULT_PENDING_OUTPUT_CHARS = 30_000;

function clampTtl(value: number | undefined): number {
    if (!value || Number.isNaN(value)) return DEFAULT_JOB_TTL_MS;
    return clamp(value, MIN_JOB_TTL_MS, MAX_JOB_TTL_MS);
}

let jobTtlMs = clampTtl(undefined);

export type ProcessStatus = 'running' | 'completed' | 'failed' | 'killed';

export interface SessionStdin {
    write: (data: string, cb?: (err?: Error | null) => void) => void;
    end: () => void;
    destroy?: () => void;
    destroyed?: boolean;
}

export interface ProcessSession {
    id: string;
    command: string;
    scopeKey?: string;
    sessionKey?: string;
    notifyOnExit?: boolean;
    notifyOnExitEmptySuccess?: boolean;
    exitNotified?: boolean;
    stdin?: SessionStdin;
    pid?: number;
    startedAt: number;
    cwd?: string;
    maxOutputChars: number;
    pendingMaxOutputChars?: number;
    totalOutputChars: number;
    pendingStdout: string[];
    pendingStderr: string[];
    pendingStdoutChars: number;
    pendingStderrChars: number;
    aggregated: string;
    tail: string;
    exitCode?: number | null;
    exitSignal?: string | number | null;
    exited: boolean;
    truncated: boolean;
    backgrounded: boolean;
}

export interface FinishedSession {
    id: string;
    command: string;
    scopeKey?: string;
    startedAt: number;
    endedAt: number;
    cwd?: string;
    status: ProcessStatus;
    exitCode?: number | null;
    exitSignal?: string | number | null;
    aggregated: string;
    tail: string;
    truncated: boolean;
    totalOutputChars: number;
}

const runningSessions = new Map<string, ProcessSession>();
const finishedSessions = new Map<string, FinishedSession>();
let sweeper: ReturnType<typeof setInterval> | null = null;

function isSessionIdTaken(id: string): boolean {
    return runningSessions.has(id) || finishedSessions.has(id);
}

let slugCounter = 0;
export function createSessionSlug(): string {
    let id: string;
    do { id = `proc_${Date.now().toString(36)}_${(++slugCounter).toString(36)}`; } while (isSessionIdTaken(id));
    return id;
}

export function addSession(session: ProcessSession): void {
    runningSessions.set(session.id, session);
    startSweeper();
}

export function getSession(id: string): ProcessSession | undefined { return runningSessions.get(id); }
export function getFinishedSession(id: string): FinishedSession | undefined { return finishedSessions.get(id); }

export function deleteSession(id: string): void {
    runningSessions.delete(id);
    finishedSessions.delete(id);
}

export function appendOutput(session: ProcessSession, stream: 'stdout' | 'stderr', chunk: string): void {
    const buffer = stream === 'stdout' ? session.pendingStdout : session.pendingStderr;
    const pendingCap = Math.min(session.pendingMaxOutputChars ?? DEFAULT_PENDING_OUTPUT_CHARS, session.maxOutputChars);
    buffer.push(chunk);
    let pendingChars = (stream === 'stdout' ? session.pendingStdoutChars : session.pendingStderrChars) + chunk.length;
    if (pendingChars > pendingCap) {
        session.truncated = true;
        pendingChars = capPendingBuffer(buffer, pendingChars, pendingCap);
    }
    if (stream === 'stdout') session.pendingStdoutChars = pendingChars;
    else session.pendingStderrChars = pendingChars;
    session.totalOutputChars += chunk.length;
    const aggregated = trimWithCap(session.aggregated + chunk, session.maxOutputChars);
    session.truncated = session.truncated || aggregated.length < session.aggregated.length + chunk.length;
    session.aggregated = aggregated;
    session.tail = tail(session.aggregated, 2000);
}

export function drainSession(session: ProcessSession): { stdout: string; stderr: string } {
    const stdout = session.pendingStdout.join('');
    const stderr = session.pendingStderr.join('');
    session.pendingStdout = [];
    session.pendingStderr = [];
    session.pendingStdoutChars = 0;
    session.pendingStderrChars = 0;
    return { stdout, stderr };
}

export function markExited(session: ProcessSession, exitCode: number | null, exitSignal: string | number | null, status: ProcessStatus): void {
    session.exited = true;
    session.exitCode = exitCode;
    session.exitSignal = exitSignal;
    session.tail = tail(session.aggregated, 2000);
    moveToFinished(session, status);
}

export function markBackgrounded(session: ProcessSession): void { session.backgrounded = true; }

function moveToFinished(session: ProcessSession, status: ProcessStatus): void {
    runningSessions.delete(session.id);
    if (session.stdin) {
        try { session.stdin.destroy?.(); } catch { /* */ }
        try { session.stdin.end(); } catch { /* */ }
        delete session.stdin;
    }
    if (!session.backgrounded) return;
    finishedSessions.set(session.id, {
        id: session.id, command: session.command, scopeKey: session.scopeKey,
        startedAt: session.startedAt, endedAt: Date.now(), cwd: session.cwd,
        status, exitCode: session.exitCode, exitSignal: session.exitSignal,
        aggregated: session.aggregated, tail: session.tail,
        truncated: session.truncated, totalOutputChars: session.totalOutputChars,
    });
}

export function tail(text: string, max = 2000): string {
    return text.length <= max ? text : text.slice(text.length - max);
}

function capPendingBuffer(buffer: string[], pendingChars: number, cap: number): number {
    if (pendingChars <= cap) return pendingChars;
    const last = buffer.at(-1);
    if (last && last.length >= cap) { buffer.length = 0; buffer.push(last.slice(last.length - cap)); return cap; }
    while (buffer.length && pendingChars - buffer[0].length >= cap) { pendingChars -= buffer[0].length; buffer.shift(); }
    if (buffer.length && pendingChars > cap) { const overflow = pendingChars - cap; buffer[0] = buffer[0].slice(overflow); pendingChars = cap; }
    return pendingChars;
}

export function trimWithCap(text: string, max: number): string {
    return text.length <= max ? text : text.slice(text.length - max);
}

export function listRunningSessions(): ProcessSession[] { return [...runningSessions.values()].filter((s) => s.backgrounded); }
export function listFinishedSessions(): FinishedSession[] { return [...finishedSessions.values()]; }
export function clearFinished(): void { finishedSessions.clear(); }

export function resetProcessRegistryForTests(): void {
    runningSessions.clear();
    finishedSessions.clear();
    stopSweeper();
}

export function setJobTtlMs(value?: number): void {
    if (value === undefined || Number.isNaN(value)) return;
    jobTtlMs = clampTtl(value);
    stopSweeper();
    startSweeper();
}

function pruneFinishedSessions(): void {
    const cutoff = Date.now() - jobTtlMs;
    for (const [id, session] of finishedSessions.entries()) {
        if (session.endedAt < cutoff) finishedSessions.delete(id);
    }
}

function startSweeper(): void {
    if (sweeper) return;
    sweeper = setInterval(pruneFinishedSessions, Math.max(30_000, jobTtlMs / 6));
    sweeper.unref?.();
}

function stopSweeper(): void {
    if (!sweeper) return;
    clearInterval(sweeper);
    sweeper = null;
}
