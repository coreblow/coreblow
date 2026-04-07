import type { DiscordClient } from '../types-sdk.js';
import { discordLog } from '../utils/logger.js';
import type { SlashCommand } from '../types.js';

export async function syncCommands(client: DiscordClient & { application?: { commands: { set(payload: unknown[]): Promise<void> } } }, token: string | undefined, commands: Map<string, SlashCommand>): Promise<void> {
    if (!client.application) {
        discordLog.error('Client application not ready, cannot sync commands');
        return;
    }
    
    try {
        const payload = Array.from(commands.values()).map(cmd => ({
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || [],
        }));
        
        discordLog.info(`Syncing ${payload.length} slash commands...`);
        await client.application.commands.set(payload);
        discordLog.info('Slash commands synced successfully');
    } catch (err) {
        discordLog.error({ err: err instanceof Error ? err.message : String(err) }, 'Failed to sync slash commands');
    }
}
