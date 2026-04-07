/**
 * agents/shell-utils.ts
 * Shell command utilities — escaping, parsing, validation.
 */
const UNSAFE_PATTERNS = [/\brm\s+-rf\s+\//i, /;\s*rm\s+-rf/i, /&&\s*rm\s/i, /\|\s*sh\b/i, />\s*\/dev\/sd/i, /mkfs\./i, /dd\s+if=/i, /chmod\s+777/i, /curl.*\|\s*bash/i, /wget.*\|\s*sh/i];

export function escapeShellArg(arg: string): string {
    return `'${arg.replace(/'/g, "'\\''")}'`;
}
export function escapeShellCmd(parts: string[]): string {
    return parts.map(escapeShellArg).join(' ');
}
export function splitShellCommand(cmd: string): { program: string; args: string[] } {
    const trimmed = cmd.trim();
    const parts = trimmed.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ?? [];
    return { program: parts[0] ?? '', args: parts.slice(1) };
}
export function isUnsafeCommand(cmd: string): { unsafe: boolean; reason?: string } {
    for (const pattern of UNSAFE_PATTERNS) {
        if (pattern.test(cmd)) return { unsafe: true, reason: `Matches dangerous pattern: ${pattern.source}` };
    }
    return { unsafe: false };
}
export function detectShell(): string {
    return process.env.SHELL ?? (process.platform === 'win32' ? 'cmd.exe' : '/bin/sh');
}
export function buildShellExec(command: string, shell?: string): { cmd: string; args: string[] } {
    const sh = shell ?? detectShell();
    return { cmd: sh, args: ['-c', command] };
}
export function sanitizeEnvVars(env: Record<string, string | undefined>, allowList?: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    const allowed = allowList ? new Set(allowList) : null;
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) continue;
        if (allowed && !allowed.has(key)) continue;
        result[key] = value;
    }
    return result;
}
