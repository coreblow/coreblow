/**
 * CoreBlow — Bash Tools Shared Utilities (CoreBlow Parity)
 *
 * Command sanitization, arg validation, working directory checks,
 * env var filtering, and PATH manipulation.
 */

import fs from 'node:fs';
import path from 'node:path';

// ─── Command Sanitization ───────────────────────────────────────

/** Characters that should be escaped in shell commands */
const SHELL_META_CHARS = /[|&;<>`$(){}[\]!#~?*'"\\]/;

export function sanitizeCommand(command: string): string {
    return command
        .replace(/\x00/g, '')         // Remove null bytes
        .replace(/\r\n/g, '\n')       // Normalize line endings
        .replace(/\r/g, '\n')
        .trim();
}

export function isMultilineCommand(command: string): boolean {
    return command.includes('\n') || command.includes('\\');
}

export function hasShellMetaChars(command: string): boolean {
    return SHELL_META_CHARS.test(command);
}

/**
 * Extract the base command name (first word) from a command string.
 */
export function extractBaseCommand(command: string): string {
    const sanitized = sanitizeCommand(command);
    const firstLine = sanitized.split('\n')[0] ?? '';
    const parts = firstLine.trim().split(/\s+/);

    // Handle env prefix: `env VAR=val command`
    let i = 0;
    while (i < parts.length) {
        const part = parts[i]!;
        if (part === 'env' || part.includes('=')) {
            i++;
            continue;
        }
        // Handle sudo/doas prefix
        if (part === 'sudo' || part === 'doas') {
            i++;
            continue;
        }
        return part;
    }
    return parts[0] ?? '';
}

// ─── Working Directory Validation ───────────────────────────────

export function validateWorkingDirectory(cwd: string, mode: 'strict' | 'lenient' | 'none' = 'strict'): {
    valid: boolean;
    resolved: string;
    error?: string;
} {
    if (mode === 'none') {
        return { valid: true, resolved: cwd };
    }

    const resolved = path.resolve(cwd);

    try {
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
            return { valid: false, resolved, error: `Not a directory: ${resolved}` };
        }
    } catch (err) {
        if (mode === 'strict') {
            return { valid: false, resolved, error: `Directory not found: ${resolved}` };
        }
        // lenient: allow non-existent directories
    }

    return { valid: true, resolved };
}

export function resolveWorkingDirectory(cwd?: string, fallback?: string): string {
    if (cwd) {
        const resolved = path.resolve(cwd);
        try {
            if (fs.statSync(resolved).isDirectory()) return resolved;
        } catch { /* fall through */ }
    }
    if (fallback) {
        const resolved = path.resolve(fallback);
        try {
            if (fs.statSync(resolved).isDirectory()) return resolved;
        } catch { /* fall through */ }
    }
    return process.cwd();
}

// ─── Environment Variable Filtering ─────────────────────────────

/** Env vars that should never be passed to child processes */
const BLOCKED_ENV_VARS = new Set([
    'COREBLOW_ADMIN_KEY',
    'COREBLOW_SECRET_KEY',
    'COREBLOW_DB_PASSWORD',
    'AWS_SECRET_ACCESS_KEY',
    'GH_TOKEN',
    'GITHUB_TOKEN',
]);

/** Env vars that are safe to inherit from parent process */
const SAFE_INHERIT_ENV_VARS = new Set([
    'HOME',
    'USER',
    'SHELL',
    'PATH',
    'TERM',
    'LANG',
    'LC_ALL',
    'EDITOR',
    'VISUAL',
    'NODE_ENV',
    'TZ',
    'TMPDIR',
    'XDG_CONFIG_HOME',
    'XDG_DATA_HOME',
    'XDG_CACHE_HOME',
]);

export function filterEnvironment(
    env: Record<string, string | undefined>,
    options?: {
        allowAll?: boolean;
        inject?: Record<string, string>;
        block?: string[];
    },
): Record<string, string> {
    const result: Record<string, string> = {};

    if (options?.allowAll) {
        for (const [key, value] of Object.entries(env)) {
            if (value !== undefined && !BLOCKED_ENV_VARS.has(key)) {
                result[key] = value;
            }
        }
    } else {
        for (const [key, value] of Object.entries(env)) {
            if (value !== undefined && SAFE_INHERIT_ENV_VARS.has(key)) {
                result[key] = value;
            }
        }
    }

    // Remove explicitly blocked vars
    if (options?.block) {
        for (const key of options.block) delete result[key];
    }

    // Always block sensitive vars
    for (const key of BLOCKED_ENV_VARS) delete result[key];

    // Inject custom vars
    if (options?.inject) {
        for (const [key, value] of Object.entries(options.inject)) {
            result[key] = value;
        }
    }

    return result;
}

// ─── PATH Manipulation ──────────────────────────────────────────

export function prependToPath(currentPath: string, ...dirs: string[]): string {
    const parts = currentPath.split(path.delimiter);
    const toAdd = dirs.filter(d => d && !parts.includes(d));
    return [...toAdd, ...parts].join(path.delimiter);
}

export function appendToPath(currentPath: string, ...dirs: string[]): string {
    const parts = currentPath.split(path.delimiter);
    const toAdd = dirs.filter(d => d && !parts.includes(d));
    return [...parts, ...toAdd].join(path.delimiter);
}

export function removeFromPath(currentPath: string, ...dirs: string[]): string {
    const remove = new Set(dirs);
    return currentPath
        .split(path.delimiter)
        .filter(p => !remove.has(p))
        .join(path.delimiter);
}

/**
 * Resolve executable path by searching PATH.
 */
export function resolveExecutable(name: string, pathEnv?: string): string | null {
    const searchPath = pathEnv ?? process.env.PATH ?? '';
    const dirs = searchPath.split(path.delimiter);

    for (const dir of dirs) {
        const fullPath = path.join(dir, name);
        try {
            fs.accessSync(fullPath, fs.constants.X_OK);
            return fullPath;
        } catch { /* continue */ }
    }
    return null;
}

// ─── Shell Detection ────────────────────────────────────────────

export function detectDefaultShell(): string {
    return process.env.SHELL ?? '/bin/bash';
}

export function resolveShell(preferred?: string): string {
    if (preferred) {
        const resolved = resolveExecutable(preferred);
        if (resolved) return resolved;
    }
    return detectDefaultShell();
}

// ─── Signal Mapping ─────────────────────────────────────────────

const SIGNAL_DESCRIPTIONS: Record<string, string> = {
    SIGHUP: 'Hangup',
    SIGINT: 'Interrupt (Ctrl+C)',
    SIGQUIT: 'Quit',
    SIGILL: 'Illegal instruction',
    SIGABRT: 'Abort',
    SIGFPE: 'Floating-point exception',
    SIGKILL: 'Killed',
    SIGSEGV: 'Segmentation fault',
    SIGPIPE: 'Broken pipe',
    SIGALRM: 'Alarm',
    SIGTERM: 'Terminated',
    SIGUSR1: 'User signal 1',
    SIGUSR2: 'User signal 2',
};

export function describeSignal(signal: string): string {
    return SIGNAL_DESCRIPTIONS[signal] ?? `Signal: ${signal}`;
}

export function describeExitCode(code: number | null, signal: string | null): string {
    if (signal) return describeSignal(signal);
    if (code === null) return 'Unknown exit';
    if (code === 0) return 'Success';
    if (code === 1) return 'General error';
    if (code === 2) return 'Misuse of shell command';
    if (code === 126) return 'Command not executable';
    if (code === 127) return 'Command not found';
    if (code === 128) return 'Invalid exit argument';
    if (code > 128) return `Killed by signal ${code - 128}`;
    return `Exit code ${code}`;
}

// ─── CoreBlow Parity Utilities ──────────────────────────────────

export function readEnvInt(name: string): number | undefined {
    const raw = process.env[name];
    if (raw === undefined || raw === '') return undefined;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
}

export function clampWithDefault(
    value: number | undefined,
    defaultValue: number,
    min: number,
    max: number,
): number {
    const v = value ?? defaultValue;
    return Math.max(min, Math.min(max, v));
}

export function truncateMiddle(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    const half = Math.floor((maxLen - 3) / 2);
    return `${text.slice(0, half)}...${text.slice(-half)}`;
}

export function chunkString(str: string, maxChunkSize = 16_384): string[] {
    if (str.length <= maxChunkSize) return [str];
    const chunks: string[] = [];
    for (let i = 0; i < str.length; i += maxChunkSize) {
        chunks.push(str.slice(i, i + maxChunkSize));
    }
    return chunks;
}

export function coerceEnv(env: NodeJS.ProcessEnv): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
        if (value !== undefined) result[key] = value;
    }
    return result;
}

// ─── Sandbox Config & Workdir ───────────────────────────────────

export type BashSandboxConfig = {
    containerName: string;
    containerWorkdir: string;
    env?: Record<string, string>;
    buildExecSpec?: (params: {
        command: string;
        workdir: string;
        env: Record<string, string>;
        usePty: boolean;
    }) => Promise<{
        argv: string[];
        env?: NodeJS.ProcessEnv;
        stdinMode?: 'pipe-open' | 'pipe-closed';
        finalizeToken?: unknown;
    } | null>;
    finalizeExec?: (params: {
        status: string;
        exitCode: number | null;
        timedOut: boolean;
        token?: unknown;
    }) => Promise<void>;
};

export function buildDockerExecArgs(params: {
    containerName: string;
    command: string;
    workdir: string;
    env: Record<string, string>;
    tty?: boolean;
}): string[] {
    const args: string[] = ['exec'];
    if (params.tty) args.push('-t');
    args.push('-i');
    args.push('-w', params.workdir);
    for (const [key, value] of Object.entries(params.env)) {
        args.push('-e', `${key}=${value}`);
    }
    args.push(params.containerName, '/bin/sh', '-c', params.command);
    return args;
}

export function buildSandboxEnv(params: {
    defaultPath: string;
    paramsEnv?: Record<string, string>;
    sandboxEnv?: Record<string, string>;
    containerWorkdir?: string;
}): Record<string, string> {
    const env: Record<string, string> = {
        PATH: params.defaultPath,
        ...params.sandboxEnv,
        ...params.paramsEnv,
    };
    if (params.containerWorkdir) {
        env.PWD = params.containerWorkdir;
    }
    return env;
}

export async function resolveSandboxWorkdir(params: {
    workdir: string;
    sandbox: BashSandboxConfig;
    warnings: string[];
}): Promise<{ hostWorkdir: string; containerWorkdir: string }> {
    return {
        hostWorkdir: params.workdir,
        containerWorkdir: params.sandbox.containerWorkdir,
    };
}

export function resolveWorkdir(rawWorkdir: string, warnings: string[]): string {
    const resolved = path.resolve(rawWorkdir);
    try {
        const stat = fs.statSync(resolved);
        if (!stat.isDirectory()) {
            warnings.push(`Warning: workdir is not a directory: ${resolved}`);
            return process.cwd();
        }
    } catch {
        warnings.push(`Warning: workdir not found: ${resolved}`);
        return process.cwd();
    }
    return resolved;
}
