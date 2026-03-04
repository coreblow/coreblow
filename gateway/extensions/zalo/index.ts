import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'zalo', version: '1.0.0', description: 'Zalo OA channel (Vietnam)', tags: ['channel', 'regional'] },
    configSchema: [
        { key: 'oaId', label: 'Zalo OA ID', type: 'string', required: true },
        { key: 'accessToken', label: 'Access Token', type: 'password', required: true },
    ],
    channel: { name: 'zalo', async start(ctx) { ctx.logger.info('Zalo OA started'); }, async stop() { }, isConnected() { return true; } },
    async init(ctx) { ctx.logger.info('Zalo extension initialized'); },
});
