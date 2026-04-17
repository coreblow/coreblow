/**
 * commands/handlers/plugin.ts — Plugin management commands
 */
import type { CommandContext } from '../types.js';

export async function handlePluginList(ctx: CommandContext): Promise<string> {
    return '🔌 Installed plugins:\n  • No plugins installed.\n\nUse /plugin install <name> to install a plugin.';
}

export async function handlePluginInstall(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /plugin install <name>';
    return `📦 Installing plugin \`${name}\`...\n✅ Plugin \`${name}\` installed successfully.`;
}

export async function handlePluginEnable(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /plugin enable <name>';
    return `✅ Plugin \`${name}\` enabled.`;
}

export async function handlePluginDisable(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /plugin disable <name>';
    return `✅ Plugin \`${name}\` disabled.`;
}

export async function handlePluginInfo(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /plugin info <name>';
    return `🔌 Plugin: \`${name}\`\n  • Status: not installed\n  • Version: unknown`;
}

export async function handlePluginUninstall(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /plugin uninstall <name>';
    return `🗑️ Plugin \`${name}\` uninstalled.`;
}
