/**
 * src/channels/discord/channel.ts
 * Main DiscordChannel class — implements ChannelAdapter
 * Uses modular components from the 82-file architecture
 */

import type { ChannelAdapter, ChannelStatus } from '../interface.js';
import { chunkMessage } from '../interface.js';
import type { MessageRouter } from '../../gateway/router.js';
import type { DiscordConfig, SlashCommand, ChannelStats, DiscordModal } from './types.js';
import type { OutboundMessage } from '../../gateway/router.js';
import { resolveConfig, type ResolvedConfig } from './config.js';
import { createClient, loginClient, destroyClient } from './client.js';
import { registerAllEvents } from './events/index.js';
import { RichResponse } from './components/rich-response.js';
import { formatAIResponse } from './embeds/response.js';
import type { DiscordClient, DiscordInteraction } from './types-sdk.js';
import { askCommand } from './commands/ask.js';
import { modelCommand } from './commands/model.js';
import { statusCommand } from './commands/status.js';
import { helpCommand } from './commands/help.js';
import { clearCommand } from './commands/clear.js';
import { discordLog } from './utils/logger.js';

 export class DiscordChannel implements ChannelAdapter {
 name = 'discord';
 private client: DiscordClient | null = null;
 private config: ResolvedConfig;
 private connected = false;
 private startedAt = 0;
 private router?: MessageRouter;
 private slashCommands = new Map<string, SlashCommand>();
 private stats: ChannelStats = {
 messageCount: 0,
 reactionCount: 0,
 componentsHandled: 0,
 selectMenusUsed: 0,
 modalsOpened: 0,
 paginatedResponses: 0,
 };
 private paginationState = new Map<string, { response: RichResponse; page: number }>();

 constructor(config: DiscordConfig) {
 this.config = resolveConfig(config);
 }

 registerSlashCommand(command: SlashCommand): void {
 this.slashCommands.set(command.name, command);
 discordLog.info({ command: command.name }, 'Slash command registered');
 }

 getAllSlashCommands(): SlashCommand[] {
 return [...this.slashCommands.values()];
 }

 registerBuiltinCommands(): void {
 const builtins = [
 askCommand(this), modelCommand(this), statusCommand(this),
 helpCommand(this), clearCommand(this),
 ];
 for (const cmd of builtins) this.registerSlashCommand(cmd);
 discordLog.info({ count: builtins.length }, 'Built-in slash commands registered');
 }

 async start(router: MessageRouter) {
 this.router = router;

 try {
 this.client = await createClient({
 token: this.config.token,
 onError: (err) => discordLog.error({ err: err instanceof Error ? err.message : String(err) }, 'Discord client error'),
 }) as unknown as DiscordClient;

 registerAllEvents({
 client: this.client,
 config: this.config,
 router,
 commands: this.slashCommands,
 stats: this.stats,
 paginationState: this.paginationState,
 onConnected: () => {
 this.connected = true;
 this.startedAt = Date.now();
 },
 });

 router.registerChannelSender('discord', async (msg) => {
 await this.sendMessage(msg);
 });

 await loginClient(this.client as any, this.config.token);
 } catch (err: unknown) {
 discordLog.error({ err: err instanceof Error ? err.message : String(err) }, 'Failed to start Discord channel');
 throw err;
 }
 }

 private async sendMessage(msg: OutboundMessage & { richResponse?: RichResponse; embed?: Record<string, unknown>; model?: string; tokens?: number; latencyMs?: number; groupId?: string; senderId?: string }): Promise<void> {
 const channelId = msg.groupId || msg.senderId;

 try {
 if (!this.client) return;
 if (!channelId) return;
  let channel = this.client.channels.cache.get(channelId);
 if (!channel) channel = await this.client.channels.fetch(channelId).catch(() => null) as any;
 if (!channel) {
 const user = msg.senderId ? await this.client.users.fetch(msg.senderId).catch(() => null) : null;
 if (user) channel = await user.createDM() as any;
 }
 if (!channel || !('send' in channel)) return;

 if (msg.richResponse instanceof RichResponse) {
 await channel.send(msg.richResponse.toPayload());
 return;
 }

 if (this.config.richResponses && msg.text && !msg.embed) {
 const rich = formatAIResponse({ text: msg.text, model: msg.model, tokens: msg.tokens, latencyMs: msg.latencyMs, sessionId: msg.senderId });
 const payload = rich.toPayload();
 if (rich.pageCount > 1) {
 this.stats.paginatedResponses++;
 this.paginationState.set(msg.senderId || 'default', { response: rich, page: 0 });
 }
 await channel.send(payload);
 return;
 }

 if (msg.embed) {
 const rich = new RichResponse().embed(msg.embed);
 await channel.send(rich.toPayload());
 return;
 }

 const chunks = chunkMessage(msg.text, 2000);
 for (const chunk of chunks) await channel.send(chunk);
 } catch (err: unknown) {
 discordLog.error({ err: err instanceof Error ? err.message : String(err), channelId }, 'Failed to send Discord message');
 }
 }

 async showModal(interaction: DiscordInteraction, modal: DiscordModal): Promise<void> {
 const rich = new RichResponse().modal(modal);
 const modalData = rich.getModal();
 if (modalData && interaction.showModal) {
 this.stats.modalsOpened++;
 await interaction.showModal(modalData);
 }
 }

 async stop() {
 if (this.client) {
 destroyClient(this.client);
 this.connected = false;
 this.paginationState.clear();
 }
 }

 isConnected() { return this.connected; }

 getStatus(): ChannelStatus {
 return {
 name: 'discord',
 connected: this.connected,
 uptime: this.connected ? Date.now() - this.startedAt : 0,
 details: {
 tag: this.client?.user?.tag,
 guilds: this.client?.guilds?.cache?.size || 0,
 messagesProcessed: this.stats.messageCount,
 reactions: this.stats.reactionCount,
 slashCommands: this.slashCommands.size,
 allowedChannels: this.config.allowedChannels.length || 'all',
 threadMode: this.config.threadMode,
 componentsHandled: this.stats.componentsHandled,
 selectMenusUsed: this.stats.selectMenusUsed,
 modalsOpened: this.stats.modalsOpened,
 paginatedResponses: this.stats.paginatedResponses,
 richResponses: this.config.richResponses,
 },
 };
 }
}
