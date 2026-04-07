/**
 * agents/bash-tools.shared.ts
 * Bash tool definitions shared across agent & sandbox modules.
 */

/** Commands that are always blocked regardless of sandbox mode. */
export const BLOCKED_COMMANDS = [
    'rm -rf /', 'rm -rf ~', 'mkfs', 'dd if=/dev/zero',
    ':(){:|:&};:', 'fork()', '> /dev/sda',
    'chmod -R 777 /', 'chown -R',
] as const;

/** Commands that are safe to run without approval. */
export const SAFE_COMMANDS = [
    'echo', 'cat', 'ls', 'pwd', 'date', 'whoami', 'uname',
    'head', 'tail', 'wc', 'sort', 'uniq', 'grep', 'find',
    'which', 'type', 'file', 'stat', 'du', 'df',
] as const;

/** Check if a command contains any blocked patterns. */
export function isBlockedCommand(cmd: string): boolean {
    const normalized = cmd.trim().toLowerCase();
    return BLOCKED_COMMANDS.some(blocked => normalized.includes(blocked.toLowerCase()));
}

/** Check if a command starts with a safe command. */
export function isSafeCommand(cmd: string): boolean {
    const firstWord = cmd.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    return (SAFE_COMMANDS as readonly string[]).includes(firstWord);
}

/** Extract the base command from a full command string. */
export function extractBaseCommand(cmd: string): string {
    return cmd.trim().split(/\s+/)[0] ?? '';
}
