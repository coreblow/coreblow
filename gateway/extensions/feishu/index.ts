import { defineExtension } from '../../src/plugins/sdk.js';
export default defineExtension({
    meta: { name: 'feishu', version: '1.0.0', description: 'Feishu/Lark channel (China enterprise)', tags: ['channel', 'enterprise'] },
    configSchema: [
        { key: 'appId', label: 'App ID', type: 'string', required: true },
        { key: 'appSecret', label: 'App Secret', type: 'password', required: true },
    ],
    channel: { name: 'feishu', async start(ctx) { ctx.logger.info('Feishu started'); }, async stop() { }, isConnected() { return true; } },
    async init(ctx) { ctx.logger.info('Feishu extension initialized'); },
});
