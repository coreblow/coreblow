/**
 * commands/command-parser.ts
 * Parse `/command arg1 arg2 --flag` syntax.
 */

import { parseFlags } from './impl/types.js';

export interface ParsedCommand {
    command: string;
    args: string[];
    flags: Record<string, string | boolean>;
    raw: string;
}

/** Parse a raw command string into structured form. */
export function parseCommand(input: string): ParsedCommand | null {
    const trimmed = input.trim();

    // Must start with /
    if (!trimmed.startsWith('/') || trimmed.length < 2) return null;
    // Skip double slash (e.g. //)
    if (trimmed.startsWith('//')) return null;

    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0].toLowerCase();
    const { positional, flags } = parseFlags(parts.slice(1));

    return { command, args: positional, flags, raw: trimmed };
}
