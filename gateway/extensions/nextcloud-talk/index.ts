import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'nextcloud-talk', version: '1.0.0', description: 'Nextcloud Talk channel (OCS API)', tags: ['channel', 'self-hosted'] },
    configSchema: [
        { key: 'url', label: 'Nextcloud URL', type: 'string', required: true },
        { key: 'username', label: 'Bot Username', type: 'string', required: true },
        { key: 'password', label: 'App Password', type: 'password', required: true },
    ],
    channel: { name: 'nextcloud-talk', async start(ctx) { ctx.logger.info('Nextcloud Talk started'); }, async stop() { }, isConnected() { return true; } },
    async init(ctx) { ctx.logger.info('Nextcloud Talk initialized'); },
});
