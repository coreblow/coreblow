import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'synology-chat', version: '1.0.0', description: 'Synology Chat NAS integration', tags: ['channel', 'self-hosted'] },
    configSchema: [
        { key: 'url', label: 'Synology URL', type: 'string', required: true },
        { key: 'token', label: 'Bot Token', type: 'password', required: true },
    ],
    channel: { name: 'synology-chat', async start(ctx) { ctx.logger.info('Synology Chat started'); }, async stop() { }, isConnected() { return true; } },
    async init(ctx) { ctx.logger.info('Synology Chat initialized'); },
});
