/**
 * cli/argv.ts
 * Argument parsing / normalization layer.
 * Ported from OpenClaw src/cli/argv.ts.
 */

export interface ParsedArgv {
    command: string;
    subcommand?: string;
    args: string[];
    flags: Record<string, string | boolean>;
    raw: string[];
}

/**
 * Parse CLI argv into a structured object.
 */
export function parseArgv(argv: string[]): ParsedArgv {
    const raw = argv.slice(2); // strip node + script
    const flags: Record<string, string | boolean> = {};
    const positional: string[] = [];
    let dashDash = false;

    for (let i = 0; i < raw.length; i++) {
        const arg = raw[i];
        if (dashDash) { positional.push(arg); continue; }
        if (arg === '--') { dashDash = true; continue; }

        if (arg.startsWith('--')) {
            const eqIdx = arg.indexOf('=');
            if (eqIdx > 0) {
                flags[arg.slice(2, eqIdx)] = arg.slice(eqIdx + 1);
            } else {
                const next = raw[i + 1];
                if (next && !next.startsWith('-')) { flags[arg.slice(2)] = next; i++; }
                else { flags[arg.slice(2)] = true; }
            }
        } else if (arg.startsWith('-') && arg.length === 2) {
            const next = raw[i + 1];
            if (next && !next.startsWith('-')) { flags[arg.slice(1)] = next; i++; }
            else { flags[arg.slice(1)] = true; }
        } else {
            positional.push(arg);
        }
    }

    return {
        command: positional[0] ?? '',
        subcommand: positional[1],
        args: positional.slice(2),
        flags,
        raw,
    };
}

/**
 * Normalize a flag name (camelCase from kebab-case).
 */
export function normalizeFlag(flag: string): string {
    return flag.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Build argv back from parsed components.
 */
export function buildArgv(parsed: ParsedArgv): string[] {
    const result: string[] = [];
    if (parsed.command) result.push(parsed.command);
    if (parsed.subcommand) result.push(parsed.subcommand);
    result.push(...parsed.args);

    for (const [key, value] of Object.entries(parsed.flags)) {
        if (value === true) result.push(`--${key}`);
        else result.push(`--${key}`, String(value));
    }
    return result;
}

/**
 * Extract a boolean flag from parsed argv.
 */
export function extractBoolFlag(flags: Record<string, string | boolean>, name: string, alias?: string): boolean {
    if (flags[name] === true || flags[name] === 'true') return true;
    if (alias && (flags[alias] === true || flags[alias] === 'true')) return true;
    return false;
}

/**
 * Extract a string flag from parsed argv.
 */
export function extractStringFlag(flags: Record<string, string | boolean>, name: string, alias?: string): string | undefined {
    const val = flags[name] ?? (alias ? flags[alias] : undefined);
    if (typeof val === 'string') return val;
    return undefined;
}
