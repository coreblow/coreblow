/**
 * commands/impl/types.ts
 * Shared types for all command implementations.
 */

export interface CommandDef {
    name: string;
    description: string;
    usage: string;
    aliases?: string[];
    category: 'general' | 'session' | 'model' | 'admin' | 'plugin' | 'debug';
    minAuth: 'public' | 'user' | 'admin' | 'owner';
    handler: (ctx: CommandExecContext) => Promise<CommandOutput>;
}

export interface CommandExecContext {
    args: string[];
    raw: string;
    userId: string;
    channel: string;
    platform: string;
    sessionId?: string;
    flags: Record<string, string | boolean>;
}

export interface CommandOutput {
    text: string;
    ephemeral?: boolean;
    data?: unknown;
}

/** Parse flags from args: --flag, --key=value, -f */
export function parseFlags(args: string[]): { positional: string[]; flags: Record<string, string | boolean> } {
    const positional: string[] = [];
    const flags: Record<string, string | boolean> = {};

    for (const arg of args) {
        if (arg.startsWith('--')) {
            const [key, ...val] = arg.slice(2).split('=');
            flags[key] = val.length > 0 ? val.join('=') : true;
        } else if (arg.startsWith('-') && arg.length === 2) {
            flags[arg.slice(1)] = true;
        } else {
            positional.push(arg);
        }
    }

    return { positional, flags };
}
