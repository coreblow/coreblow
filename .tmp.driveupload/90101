/**
 * extensions/twitch/index.ts
 * Twitch chat extension — tmi.js based
 */
import { defineExtension } from '../../src/plugins/sdk.js';

export default defineExtension({
    meta: {
        name: 'twitch',
        version: '1.0.0',
        description: 'Twitch chat bot integration',
        tags: ['channel', 'streaming'],
    },
    configSchema: [
        { key: 'username', label: 'Bot Username', type: 'string', required: true },
        { key: 'oauth', label: 'OAuth Token', type: 'password', required: true },
        { key: 'channels', label: 'Channels to join', type: 'string', required: true, description: 'Comma-separated' },
    ],
    channel: {
        name: 'twitch',
        async start(ctx) {
            const tmi = await import('tmi.js');
            const client = new tmi.Client({
                identity: { username: ctx.config.username, password: ctx.config.oauth },
                channels: (ctx.config.channels || '').split(',').map((c: string) => c.trim()),
            });
            client.on('message', (channel: string, tags: any, message: string, self: boolean) => {
                if (self) return;
                ctx.gateway.sendMessage('twitch', tags.username || 'viewer', message);
            });
            await client.connect();
            ctx.logger.info('Twitch bot connected');
        },
        async stop() { },
        isConnected() { return true; },
    },
    async init(ctx) { ctx.logger.info('Twitch extension initialized'); },
});
