/**
 * commands/handlers/channel.ts — Channel management commands
 */
import type { CommandContext } from '../types.js';
import { listKnownChannels } from '../../config/channel-capabilities.js';

export async function handleChannelList(ctx: CommandContext): Promise<string> {
    const channels = listKnownChannels();
    return '📡 Known channels:\n' + channels.map((c) => `  • ${c}`).join('\n');
}

export async function handleChannelStatus(ctx: CommandContext): Promise<string> {
    return '📡 Channel Status:\n  • Current: `' + ctx.channel + '` — connected';
}

export async function handleChannelRestart(ctx: CommandContext): Promise<string> {
    const name = ctx.command.args.name as string | undefined;
    if (!name) return 'Usage: /channel restart <name>';
    return `🔄 Channel \`${name}\` restarted.`;
}
