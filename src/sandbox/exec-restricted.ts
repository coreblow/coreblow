/**
 * src/sandbox/exec-restricted.ts
 * Restricted native executor — degradation mode (NOT a sandbox)
 * Used when Docker is unavailable for low-risk commands only
 *
 * ⚠ THIS IS NOT A SECURITY BOUNDARY
 * It is a best-effort policy restriction to prevent obvious accidental damage
 */

import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { createChildLogger } from '../utils/logger.js';
import type { ExecResult } from './sandbox-types.js';

const execAsync = promisify(execCb);
const log = createChildLogger('exec-restricted');

// Secrets to strip from environment
const SECRET_ENV_KEYS = [
    'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY',
    'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN',
    'GITHUB_TOKEN', 'GH_TOKEN', 'GITLAB_TOKEN',
    'COREBLOW_TOKEN', 'TELEGRAM_BOT_TOKEN',
    'DISCORD_TOKEN', 'SLACK_BOT_TOKEN',
    'DATABASE_URL', 'REDIS_URL',
    'SENDGRID_API_KEY', 'TWILIO_AUTH_TOKEN',
    'STRIPE_SECRET_KEY', 'PAYPAL_SECRET',
];

// Additional patterns for dynamic secret detection
const SECRET_PATTERNS = [
    /^.*_SECRET$/i,
    /^.*_TOKEN$/i,
    /^.*_PASSWORD$/i,
    /^.*_API_KEY$/i,
    /^.*_PRIVATE_KEY$/i,
    /^.*_AUTH$/i,
];

/**
 * Build a sanitized environment with all secrets stripped
 */
export function buildSanitizedEnv(): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = { ...process.env };

    // Remove known secret keys
    for (const key of SECRET_ENV_KEYS) {
        delete env[key];
    }

    // Remove keys matching secret patterns
    for (const key of Object.keys(env)) {
        if (SECRET_PATTERNS.some(p => p.test(key))) {
            delete env[key];
        }
    }

    // Force safe terminal
    env.TERM = 'dumb';
    // Remove shell history
    delete env.HISTFILE;
    delete env.SAVEHIST;

    return env;
}

/**
 * Execute a command in restricted native mode
 * - Environment secrets stripped
 * - Output truncated
 * - Timeout enforced
 * - Input validated for injection
 * - Signal handling for graceful cleanup
 *
 * ⚠ This does NOT prevent: filesystem access, network calls, or process spawning
 */
export async function execRestricted(
    command: string,
    opts: { cwd?: string; timeout?: number; maxOutput?: number } = {}
): Promise<ExecResult> {
    const { cwd, timeout = 30000, maxOutput = 1048576 } = opts;

    // ── Input Validation ──
    if (!command || typeof command !== 'string') {
        return {
            stdout: '', stderr: 'Invalid command: empty or non-string',
            exitCode: 1, timedOut: false, truncated: false, mode: 'restricted-native',
        };
    }

    // Reject null bytes (command injection vector)
    if (command.includes('\0')) {
        return {
            stdout: '', stderr: 'Rejected: command contains null bytes',
            exitCode: 1, timedOut: false, truncated: false, mode: 'restricted-native',
        };
    }

    // Enforce max command length (prevent buffer overflow attacks)
    const MAX_COMMAND_LENGTH = 32_768;
    if (command.length > MAX_COMMAND_LENGTH) {
        return {
            stdout: '', stderr: `Rejected: command exceeds max length (${MAX_COMMAND_LENGTH})`,
            exitCode: 1, timedOut: false, truncated: false, mode: 'restricted-native',
        };
    }

    // Enforce timeout bounds
    const safeTimeout = Math.max(100, Math.min(timeout, 300_000)); // 100ms - 5min
    const safeMaxOutput = Math.max(1024, Math.min(maxOutput, 10_485_760)); // 1KB - 10MB

    log.warn({ command: command.slice(0, 80) },
        '⚠ Running in restricted-native mode (NOT sandboxed)');

    try {
        const cleanEnv = buildSanitizedEnv();

        const { stdout, stderr } = await execAsync(command, {
            cwd: cwd || process.env.HOME,
            timeout: safeTimeout,
            maxBuffer: safeMaxOutput,
            env: cleanEnv,
        });

        const truncatedStdout = truncateOutput(stdout, safeMaxOutput);
        const truncatedStderr = truncateOutput(stderr, safeMaxOutput);

        return {
            stdout: truncatedStdout,
            stderr: truncatedStderr,
            exitCode: 0,
            timedOut: false,
            truncated: (stdout?.length ?? 0) > safeMaxOutput,
            mode: 'restricted-native',
        };
    } catch (err: unknown) {
        const e = err as { killed?: boolean; signal?: string; stdout?: string; stderr?: string; code?: number; message?: string };
        const timedOut = e.killed === true;
        const signal = e.signal;

        return {
            stdout: truncateOutput(e.stdout ?? '', safeMaxOutput),
            stderr: truncateOutput(e.stderr ?? e.message ?? '', safeMaxOutput),
            exitCode: typeof e.code === 'number' ? e.code : 1,
            signal,
            timedOut,
            truncated: false,
            mode: 'restricted-native',
        };
    }
}

function truncateOutput(text: string | undefined, maxLen: number): string {
    if (!text) return '';
    if (text.length <= maxLen) return text;
    return text.slice(0, maxLen) + '\n... (output truncated)';
}
