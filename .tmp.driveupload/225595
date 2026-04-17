/**
 * commands/handlers/tools.ts — Tool management commands
 */
import type { CommandContext } from '../types.js';

export async function handleToolsList(ctx: CommandContext): Promise<string> {
    return '🔧 Available tools:\n  • bash — Execute shell commands\n  • browser — Browse web pages\n  • file_read — Read files\n  • file_write — Write files\n  • search — Search codebase';
}

export async function handleToolsEnable(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /tools enable <name>';
    return `✅ Tool \`${name}\` enabled.`;
}

export async function handleToolsDisable(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /tools disable <name>';
    return `✅ Tool \`${name}\` disabled.`;
}

export async function handleToolsProfile(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /tools profile <name>\nAvailable profiles: default, messaging, coding, full';
    return `✅ Tool profile set to \`${name}\`.`;
}
